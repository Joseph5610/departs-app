import * as GtfsRt from '../../../_core/gtfsRtTypes';
import type { AppVehicleCollection, AppVehicleDetail, AppVehicleFeature } from '../../../_core/types';
import type { CityConfig } from '../../../_core/city-config';
import { deriveAsync, type Derivation, type Snapshot } from '../../../_core/feed/source';
import type { VehiclesService } from '../../gtfs/vehicles/VehiclesService';
import type { SingleLiveVehicle, VehicleSource } from '../../gtfs/vehicles/vehicle-source';
import { VehiclesMapper } from '../../gtfs/vehicles/VehiclesMapper';
import { getGtfsRoutes, type GtfsRoute } from '../../../_feeds/gtfs/gtfs-data';
import { getTripWindows } from '../../../_feeds/gtfs/trip-windows';
import { getTripStops, isLocated } from '../../../_feeds/gtfs/trip-stops';
import { LruCache } from '../../../_core/feed/LruCache';
import { bearingDeg, distanceMeters, distanceToSegmentMeters } from '../../../_core/utils/geo';
import { GTFS_CONFIG } from '../../../_feeds/gtfs/config';
import { formatTime, getLocalClock, toSecs, wrapDaySeconds, type LocalClock } from '../../../_core/utils/time';
import { getDukStationNames, getDukTrafficFeed, getDukTrafficSnapshot, type DukVehicleReport } from '../../../_feeds/duk/duk-traffic-feed';
import { TripTrackLookup, type TripTrack } from '../../../_feeds/duk/duk-trip-tracks';
import { DUK_STATE_MAPPING } from '../dukConstants';
import { getDukVehicleColor } from '../colors';
import { DukTripMatcher, type TripMatch } from './DukTripMatcher';
import { DUK_CONFIG } from '../../../_feeds/duk/config';

const { VehicleStopStatus } = GtfsRt;

/** Last position per vehicle, to derive a heading from movement where the feed has none. */
const lastFixes = new LruCache<{ lat: number; lon: number; bearing: number | null }>({ maxEntries: DUK_CONFIG.BEARING_CACHE_MAX_ENTRIES });

const OFFLINE: AppVehicleCollection = { type: 'FeatureCollection', features: [], status: 'upstream_offline' };

/** The mapped fleet per traffic snapshot: built once per feed read, however many requests read it. */
const collections = new WeakMap<object, Derivation<AppVehicleCollection>>();

/** Reports by vehicle id, built once per cached feed and collected with it. */
const reportIndexes = new WeakMap<DukVehicleReport[], Map<string, DukVehicleReport>>();

/** Waiting before, or driving to the first stop of, its trip. */
function isBeforeTrip(report: DukVehicleReport): boolean {
    return report.state !== null && DUK_STATE_MAPPING[report.state] === 'before_track';
}

function getReportIndex(reports: DukVehicleReport[]): Map<string, DukVehicleReport> {
    const existing = reportIndexes.get(reports);
    if (existing) return existing;
    const index = new Map(reports.map(r => [r.vehicleId, r]));
    reportIndexes.set(reports, index);
    return index;
}

/**
 * Vehicles for Ústecký kraj from the Portabo traffic feed, matched to the JDF-built static trips by
 * CIS JŘ line and trip number. Vehicles without a timetable (trains, trolleybuses, lines licensed
 * outside the kraj) are still shown, keeping the feed's own trip reference.
 */
export class DukVehicleSource implements VehicleSource {
    constructor(private readonly city: CityConfig) {}

    /** The fleet of the latest traffic snapshot; a failed read keeps serving the last good one. */
    async all(): Promise<AppVehicleCollection> {
        const snapshot = await getDukTrafficSnapshot(this.city).catch((err) => {
            console.error(`DUK feed error for ${this.city.slug}:`, err.message);
            return null;
        });
        if (!snapshot) return OFFLINE;
        return deriveAsync(snapshot, collections, () => this.build(snapshot));
    }

    private async build(snapshot: Snapshot<DukVehicleReport[]>): Promise<AppVehicleCollection> {
        const reports = snapshot.data;
        const [routes, windows, stationNames] = await Promise.all([
            getGtfsRoutes(this.city),
            getTripWindows(this.city),
            getDukStationNames(this.city),
        ]);

        const ctx = getLocalClock(this.city.timezone);
        const tracks = await TripTrackLookup.create(this.city, windows, ctx.mins);
        const matcher = windows ? new DukTripMatcher(windows) : null;
        const nowMs = Date.now();

        const mapped = await Promise.all(reports.map(async (report) => {
            const timestampMs = report.timestamp ? Date.parse(report.timestamp) : NaN;
            const reportedMs = Number.isNaN(timestampMs) ? nowMs : timestampMs;
            if (nowMs - reportedMs > GTFS_CONFIG.VEHICLES_STALE_THRESHOLD_MS) return null;

            const match = matcher && report.lineNumber && report.tripNumber !== null
                ? matcher.match(report.lineNumber, report.tripNumber, ctx)
                : null;
            const tripId = matcher && report.lineNumber ? await this.runningTrip(report, match, matcher, ctx, tracks) : null;
            const route = report.lineNumber ? routes.routes[report.lineNumber] : undefined;
            const bearing = report.bearing ?? await this.deriveBearing(report, tripId, tracks);
            return this.mapReport({ ...report, bearing }, reportedMs, tripId, route, stationNames);
        }));
        const features = mapped.filter((f): f is AppVehicleFeature => f !== null);

        return { type: 'FeatureCollection', features, last_updated: new Date(nowMs).toISOString() };
    }

    /**
     * The trip a moving vehicle is actually on. Portabo can report a trip number the timetable runs
     * on other days (weekend numbers on a weekday evening) or later that day; then the line's trip
     * running now towards the vehicle's final stop, closest to where the vehicle is, wins.
     */
    private async runningTrip(report: DukVehicleReport, match: TripMatch | null, matcher: DukTripMatcher, ctx: LocalClock, tracks: TripTrackLookup): Promise<string | null> {
        const isMoving = report.state !== null && DUK_STATE_MAPPING[report.state] === 'on_track';
        if (!isMoving || !report.lineNumber) return match?.tripId ?? null;
        const reported = match ? await this.distanceFromSchedule(report, match, ctx, tracks) : null;
        if (match && reported !== null && reported <= DUK_CONFIG.TRIP_FIT_M) return match.tripId;

        let best = match?.tripId ?? null;
        let bestDistance: number = DUK_CONFIG.RUNNING_TRIP_FIT_M;
        for (const candidate of matcher.runningNow(report.lineNumber, ctx, DUK_CONFIG.SCHEDULE_FIT_MARGIN_S / 60)) {
            const lastStopId = await this.lastStopId(candidate.tripId, tracks);
            if (report.finalNode !== null && lastStopId && !lastStopId.startsWith(`${report.finalNode}-`)) continue;
            const distance = await this.distanceFromSchedule(report, candidate, ctx, tracks);
            if (distance !== null && distance < bestDistance) { bestDistance = distance; best = candidate.tripId; }
        }
        return best;
    }

    /**
     * The trip's final located stop. The hour's tracks hold every trip running in it, so a miss means
     * the trip is not running now; only a missing file at all (data not rolled out yet) reads buckets.
     */
    private async lastStopId(tripId: string, tracks: TripTrackLookup): Promise<string | undefined> {
        const track = await this.trackOf(tripId, tracks);
        return track?.stopIds[track.stopIds.length - 1];
    }

    /** How far the vehicle is from where the trip's timetable, shifted by its delay, puts it now; null when it is not running now. */
    private async distanceFromSchedule(report: DukVehicleReport, match: TripMatch, ctx: LocalClock, tracks: TripTrackLookup): Promise<number | null> {
        const track = await this.trackOf(match.tripId, tracks);
        if (!track || track.departureSecs.length === 0) return null;

        const { departureSecs, lat, lon, lastArrivalSecs } = track;
        const tripSecs = (ctx.mins - match.offsetMins) * 60 - (report.delay ?? 0);
        const margin = DUK_CONFIG.SCHEDULE_FIT_MARGIN_S;
        if (tripSecs < departureSecs[0] - margin || tripSecs > lastArrivalSecs + margin) return null;

        let at = 0;
        for (let i = 0; i < departureSecs.length; i++) if (departureSecs[i] <= tripSecs) at = i;
        const next = Math.min(at + 1, departureSecs.length - 1);
        return distanceToSegmentMeters(report.latitude, report.longitude, lat[at], lon[at], lat[next], lon[next]);
    }

    /** Only for trips the hour's track file does not cover, so a data rollout can lag a deploy. */
    private async trackFromBucket(tripId: string): Promise<TripTrack | null> {
        const stops = (await getTripStops(this.city, tripId)).filter(isLocated);
        if (stops.length === 0) return null;
        const last = stops[stops.length - 1];
        return {
            stopIds: stops.map(s => s.id),
            sequence: stops.map(s => s.sequence),
            lastArrivalSecs: toSecs(last.arrival_time || last.departure_time),
            departureSecs: stops.map(s => toSecs(s.departure_time || s.arrival_time)),
            lat: stops.map(s => s.coordinates[1]),
            lon: stops.map(s => s.coordinates[0]),
        };
    }

    private mapReport(
        report: DukVehicleReport,
        timestampMs: number,
        matchedTripId: string | null,
        timetableRoute: GtfsRoute | undefined,
        stationNames: Map<number, string>
    ): AppVehicleFeature {
        const state = report.state !== null ? DUK_STATE_MAPPING[report.state] : undefined;
        const vp: GtfsRt.IVehiclePosition = {
            position: { latitude: report.latitude, longitude: report.longitude, bearing: report.bearing ?? undefined },
            currentStatus: state === 'at_stop' ? VehicleStopStatus.STOPPED_AT : VehicleStopStatus.IN_TRANSIT_TO,
            timestamp: Math.floor(timestampMs / 1000),
            vehicle: { id: report.vehicleId, label: report.vehicleId },
        };

        // Everything the feed reports without a CIS line is a train.
        const fallbackType = report.lineNumber ? 'bus' : 'train';
        const route: GtfsRoute = timetableRoute
            ?? { name: report.lineName, type: fallbackType, route_color: getDukVehicleColor(fallbackType, report.lineName) };
        const tripId = matchedTripId ?? report.feedTripId ?? `dummy-${report.vehicleId}`;

        const feature = VehiclesMapper.mapVehicle(vp, tripId, route, new Date(timestampMs).toISOString(), report.delay, state === 'before_track');
        const props = feature.properties;
        if (state === 'off_track') props.state_position = 'off_track';
        else if (!state) props.state_position = 'unknown';

        const headsign = report.finalNode !== null ? stationNames.get(report.finalNode) : undefined;
        if (headsign) props.trip_headsign = headsign;

        props.vehicle_descriptor = {
            ...props.vehicle_descriptor,
            is_wheelchair_accessible: report.isLowFloor,
            is_air_conditioned: report.isAirConditioned,
        };
        return feature;
    }

    /**
     * Heading for vehicles the feed reports without one (all of DPmÚL): towards the next stop of the
     * matched trip, else along the trip's nearest leg, else from the vehicle's own movement.
     */
    private async deriveBearing(report: DukVehicleReport, tripId: string | null, tracks: TripTrackLookup): Promise<number | null> {
        if (!tripId) return this.movementBearing(report);
        const track = await this.trackOf(tripId, tracks);
        if (!track) return this.movementBearing(report);
        return this.nextStopBearing(report, track) ?? this.legBearing(report, track) ?? this.movementBearing(report);
    }

    /** The hour's tracks cover every trip running now; a bucket is read only before the data is rolled out. */
    private async trackOf(tripId: string, tracks: TripTrackLookup): Promise<TripTrack | null> {
        return await tracks.get(tripId) ?? (tracks.allowBucketRead(tripId) ? await this.trackFromBucket(tripId) : null);
    }

    private nextStopBearing(report: DukVehicleReport, track: TripTrack): number | null {
        const passed = this.lastPassedIndex(report, track);
        if (passed === null) return null;
        for (let i = passed + 1; i < track.stopIds.length; i++) {
            const lat = track.lat[i], lon = track.lon[i];
            if (distanceMeters(report.latitude, report.longitude, lat, lon) < DUK_CONFIG.BEARING_MIN_MOVE_M) continue;
            return bearingDeg(report.latitude, report.longitude, lat, lon);
        }
        return null;
    }

    /**
     * Index in `stops` of the last stop the vehicle has passed, -1 before its first, null when unknown.
     * The feed reports it by node, which a loop visits twice; the visit due now is meant.
     */
    private lastPassedIndex(report: DukVehicleReport, track: TripTrack): number | null {
        if (report.stationNode === null) return null;
        const prefix = `${report.stationNode}-`;
        const dueSecs = getLocalClock(this.city.timezone).secs - (report.delay ?? 0);
        let reported = -1;
        let closestGap = Infinity;
        track.stopIds.forEach((id, i) => {
            if (!id.startsWith(prefix)) return;
            const gap = Math.abs(wrapDaySeconds(track.departureSecs[i] - dueSecs));
            if (gap < closestGap) { closestGap = gap; reported = i; }
        });
        if (reported < 0) return null;
        // Before its trip, the reported node is the first stop, still to come.
        return isBeforeTrip(report) ? reported - 1 : this.legStartNear(report, track, reported);
    }

    /**
     * The reported stop moved to the start of the leg a moving vehicle actually lies on: the feed
     * announces a stop ahead before reaching it and misses some it passes.
     */
    private legStartNear(report: DukVehicleReport, track: TripTrack, reported: number): number {
        if (report.state === null || DUK_STATE_MAPPING[report.state] !== 'on_track') return reported;
        // An arrival at the last stop stands; buses lay over away from the stop post.
        if (reported === track.stopIds.length - 1) return reported;

        const { latitude: lat, longitude: lon } = report;
        if (distanceMeters(lat, lon, track.lat[reported], track.lon[reported]) < DUK_CONFIG.AT_STOP_RADIUS_M) return reported;
        const legDistance = (k: number) => {
            if (k < 0 || k + 1 >= track.stopIds.length) return Infinity;
            return distanceToSegmentMeters(lat, lon, track.lat[k], track.lon[k], track.lat[k + 1], track.lon[k + 1]);
        };

        let best = reported;
        let bestDistance = Math.min(legDistance(reported) - DUK_CONFIG.APPROACH_LEG_MARGIN_M, DUK_CONFIG.MAX_ROUTE_DISTANCE_M);
        for (let k = reported - 1; k <= reported + DUK_CONFIG.MAX_SKIPPED_STOPS; k++) {
            if (k === reported) continue;
            const distance = legDistance(k);
            if (distance < bestDistance) { bestDistance = distance; best = k; }
        }
        return best;
    }

    private legBearing(report: DukVehicleReport, track: TripTrack): number | null {
        let best: number | null = null;
        let bestDistance: number = DUK_CONFIG.MAX_ROUTE_DISTANCE_M;
        for (let i = 1; i < track.stopIds.length; i++) {
            const aLat = track.lat[i - 1], aLon = track.lon[i - 1], bLat = track.lat[i], bLon = track.lon[i];
            const distance = distanceToSegmentMeters(report.latitude, report.longitude, aLat, aLon, bLat, bLon);
            if (distance >= bestDistance || (aLat === bLat && aLon === bLon)) continue;
            bestDistance = distance;
            best = bearingDeg(aLat, aLon, bLat, bLon);
        }
        return best;
    }

    private movementBearing(report: DukVehicleReport): number | null {
        const key = `${this.city.slug}:${report.vehicleId}`;
        const prev = lastFixes.get(key);
        if (!prev) {
            lastFixes.set(key, { lat: report.latitude, lon: report.longitude, bearing: null });
            return null;
        }
        if (distanceMeters(prev.lat, prev.lon, report.latitude, report.longitude) < DUK_CONFIG.BEARING_MIN_MOVE_M) return prev.bearing;
        const bearing = bearingDeg(prev.lat, prev.lon, report.latitude, report.longitude);
        lastFixes.set(key, { lat: report.latitude, lon: report.longitude, bearing });
        return bearing;
    }

    /** Adds the timetable position of the vehicle's last reached stop, which the feed reports by node. */
    async augmentSingleLiveVehicle(result: SingleLiveVehicle): Promise<SingleLiveVehicle> {
        const { liveMatch } = result;
        const tripId = liveMatch?.properties.gtfs_trip_id;
        const liveVehicleId = liveMatch?.properties.vehicle_id;
        if (!liveMatch || !tripId || !liveVehicleId) return { liveMatch };

        // One trip, so its own bucket is the cheap read here, and it carries the stop sequences the app shows.
        const [reports, track] = await Promise.all([
            getDukTrafficFeed(this.city).catch(() => null),
            this.trackFromBucket(tripId),
        ]);
        const report = reports ? getReportIndex(reports).get(liveVehicleId) : undefined;
        const passed = report && track ? this.lastPassedIndex(report, track) : null;
        if (passed === null || passed < 0) return { liveMatch };

        return { liveMatch: { ...liveMatch, properties: { ...liveMatch.properties, last_stop_sequence: track!.sequence![passed] } } };
    }
}

/**
 * Detail for a DÚK vehicle the static data has no trip for: its live state plus the last reached and
 * final stop, with gaps marking the unknown rest of the route.
 */
export async function getDukLiveOnlyDetail(
    vehicles: VehiclesService,
    city: CityConfig,
    vehicleId: string | null,
    tripId: string | null
): Promise<AppVehicleDetail | null> {
    const collection = await vehicles.getCachedMappedVehicles();
    const feature = collection.features.find(f =>
        (vehicleId && f.properties.vehicle_id === vehicleId) || (tripId && f.properties.gtfs_trip_id === tripId)
    );
    if (!feature?.properties.vehicle_id) return null;

    const [reports, stationNames] = await Promise.all([
        getDukTrafficFeed(city).catch(() => null),
        getDukStationNames(city),
    ]);
    const report = reports ? getReportIndex(reports).get(feature.properties.vehicle_id) : undefined;

    const features: NonNullable<AppVehicleDetail['stop_times']>['features'] = [];
    const localTime = (ms: number | null) => (ms === null ? '' : formatTime(new Date(ms), city.timezone));
    const addStop = (stopId: string, stopName: string, arrivalMs: number | null = null, departureMs: number | null = null) => {
        features.push({
            type: 'Feature',
            properties: {
                stop_id: stopId,
                stop_name: stopName,
                stop_sequence: features.length + 1,
                arrival_time: localTime(arrivalMs),
                departure_time: localTime(departureMs),
            }
        });
    };

    if (report?.stationNode != null) {
        addStop('incomplete-gap-start', '...');
        addStop(String(report.stationNode), stationNames.get(report.stationNode) ?? String(report.stationNode), report.stationArrivalMs, report.stationDepartureMs);
    }
    if (report?.finalNode != null && report.finalNode !== report.stationNode) {
        addStop('incomplete-gap', '...');
        addStop(String(report.finalNode), stationNames.get(report.finalNode) ?? String(report.finalNode));
    }

    return {
        ...feature.properties,
        geometry: feature.geometry,
        stop_times: { features },
    };
}
