import { transit_realtime } from 'gtfs-realtime-bindings';
import type { AppVehicleCollection, AppVehicleDetail, AppVehicleFeature } from '../../../../_core/types';
import { CacheManager, MEMORY_CACHE_TTL } from '../../../../_core/utils/CacheManager';
import { VehiclesService } from '../../../gtfs/services/vehicles/VehiclesService';
import { VehiclesMapper } from '../../../gtfs/services/vehicles/VehiclesMapper';
import { getGtfsRoutes, getGtfsTripRoutes, type GtfsRoute } from '../../../gtfs/core/gtfs-data';
import { getTripWindows } from '../../../gtfs/core/trip-windows';
import { getTripStops, isLocated } from '../../../gtfs/core/trip-stops';
import { LruCache } from '../../../../_core/utils/LruCache';
import { bearingDeg, distanceMeters, distanceToSegmentMeters } from '../../../../_core/utils/geo';
import type { Station as TripStation } from '../../../gtfs/services/vehicles/types';
import { GTFS_CONFIG } from '../../../gtfs/core/config';
import { formatTime, getLocalClock, toSecs, wrapDaySeconds, type LocalClock } from '../../../../_core/utils/time';
import { getDukStationNames, getDukTrafficFeed, type DukVehicleReport } from '../../core/duk-traffic-feed';
import { DUK_STATE_MAPPING } from '../../utils/dukConstants';
import { getDukVehicleColor } from '../../utils/colors';
import { DukTripMatcher, type TripMatch } from './DukTripMatcher';
import { DUK_CONFIG } from '../../core/config';

const { VehicleStopStatus } = transit_realtime.VehiclePosition;

/** Last position per vehicle, to derive a heading from movement where the feed has none. */
const lastFixes = new LruCache<{ lat: number; lon: number; bearing: number | null }>({ maxEntries: DUK_CONFIG.BEARING_CACHE_MAX_ENTRIES });

/** Reports by vehicle id, built once per cached feed and collected with it. */
const reportIndexes = new WeakMap<DukVehicleReport[], Map<string, DukVehicleReport>>();

/** Waiting before, or driving to the first stop of, its trip. */
function isBeforeTrip(report: DukVehicleReport): boolean {
    return report.state !== null && DUK_STATE_MAPPING[report.state] === 'before_track';
}

function lastLocatedStop(stops: TripStation[]): TripStation | undefined {
    for (let i = stops.length - 1; i >= 0; i--) if (isLocated(stops[i])) return stops[i];
    return undefined;
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
export class DukVehiclesService extends VehiclesService {
    /** There is no GTFS-RT feed here; the base raw-entity lookup is skipped by returning none. */
    protected override async getCoreData() {
        return Promise.all([
            null,
            getGtfsRoutes(this.city.slug),
            getGtfsTripRoutes(this.city.slug),
        ]);
    }

    override async getCachedMappedVehicles(): Promise<AppVehicleCollection> {
        return CacheManager.getOrFetch<AppVehicleCollection>(
            `duk_vehicles_collection_${this.city.slug}`,
            MEMORY_CACHE_TTL.SHORT_DEBOUNCE_MS,
            async () => {
                const [reports, routes, windows, stationNames] = await Promise.all([
                    getDukTrafficFeed(this.city).catch((err) => {
                        console.error(`DUK feed error for ${this.city.slug}:`, err.message);
                        return null;
                    }),
                    getGtfsRoutes(this.city.slug),
                    getTripWindows(this.city),
                    getDukStationNames(this.city),
                ]);

                if (!reports) {
                    return { type: 'FeatureCollection', features: [], status: 'upstream_offline' };
                }

                const ctx = getLocalClock(this.city.timezone);
                const matcher = windows ? new DukTripMatcher(windows) : null;
                const nowMs = Date.now();

                const mapped = await Promise.all(reports.map(async (report) => {
                    const timestampMs = report.timestamp ? Date.parse(report.timestamp) : NaN;
                    const reportedMs = Number.isNaN(timestampMs) ? nowMs : timestampMs;
                    if (nowMs - reportedMs > GTFS_CONFIG.VEHICLES_STALE_THRESHOLD_MS) return null;

                    const match = matcher && report.lineNumber && report.tripNumber !== null
                        ? matcher.match(report.lineNumber, report.tripNumber, ctx)
                        : null;
                    const tripId = matcher && report.lineNumber ? await this.runningTrip(report, match, matcher, ctx) : null;
                    const route = report.lineNumber ? routes.routes[report.lineNumber] : undefined;
                    const bearing = report.bearing ?? await this.deriveBearing(report, tripId);
                    return this.mapReport({ ...report, bearing }, reportedMs, tripId, route, stationNames);
                }));
                const features = mapped.filter((f): f is AppVehicleFeature => f !== null);

                return { type: 'FeatureCollection', features, status: 'ok' };
            },
            // An empty fleet is valid (overnight); only an unreachable upstream keeps the previous one.
            (col) => !col || col.status === 'upstream_offline'
        );
    }

    /**
     * The trip a moving vehicle is actually on. Portabo can report a trip number the timetable runs
     * on other days (weekend numbers on a weekday evening) or later that day; then the line's trip
     * running now towards the vehicle's final stop, closest to where the vehicle is, wins.
     */
    private async runningTrip(report: DukVehicleReport, match: TripMatch | null, matcher: DukTripMatcher, ctx: LocalClock): Promise<string | null> {
        const isMoving = report.state !== null && DUK_STATE_MAPPING[report.state] === 'on_track';
        if (!isMoving || !report.lineNumber) return match?.tripId ?? null;
        const reported = match ? await this.distanceFromSchedule(report, match, ctx) : null;
        if (match && reported !== null && reported <= DUK_CONFIG.TRIP_FIT_M) return match.tripId;

        let best = match?.tripId ?? null;
        let bestDistance: number = DUK_CONFIG.RUNNING_TRIP_FIT_M;
        for (const candidate of matcher.runningNow(report.lineNumber, ctx, DUK_CONFIG.SCHEDULE_FIT_MARGIN_S / 60)) {
            const last = lastLocatedStop(await getTripStops(this.city, candidate.tripId));
            if (report.finalNode !== null && last && !last.id.startsWith(`${report.finalNode}-`)) continue;
            const distance = await this.distanceFromSchedule(report, candidate, ctx);
            if (distance !== null && distance < bestDistance) { bestDistance = distance; best = candidate.tripId; }
        }
        return best;
    }

    /** How far the vehicle is from where the trip's timetable, shifted by its delay, puts it now; null when it is not running now. */
    private async distanceFromSchedule(report: DukVehicleReport, match: TripMatch, ctx: LocalClock): Promise<number | null> {
        const stops = (await getTripStops(this.city, match.tripId)).filter(isLocated);
        if (stops.length === 0) return null;
        const tripSecs = (ctx.mins - match.offsetMins) * 60 - (report.delay ?? 0);
        const margin = DUK_CONFIG.SCHEDULE_FIT_MARGIN_S;
        if (tripSecs < toSecs(stops[0].departure_time) - margin || tripSecs > toSecs(stops[stops.length - 1].arrival_time) + margin) return null;

        let at = 0;
        for (let i = 0; i < stops.length; i++) if (toSecs(stops[i].departure_time) <= tripSecs) at = i;
        const [aLon, aLat] = stops[at].coordinates;
        const [bLon, bLat] = stops[Math.min(at + 1, stops.length - 1)].coordinates;
        return distanceToSegmentMeters(report.latitude, report.longitude, aLat, aLon, bLat, bLon);
    }

    private mapReport(
        report: DukVehicleReport,
        timestampMs: number,
        matchedTripId: string | null,
        timetableRoute: GtfsRoute | undefined,
        stationNames: Map<number, string>
    ): AppVehicleFeature {
        const state = report.state !== null ? DUK_STATE_MAPPING[report.state] : undefined;
        const vp: transit_realtime.IVehiclePosition = {
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
    private async deriveBearing(report: DukVehicleReport, tripId: string | null): Promise<number | null> {
        if (!tripId) return this.movementBearing(report);
        const stops = await getTripStops(this.city, tripId);
        return this.nextStopBearing(report, stops) ?? this.legBearing(report, stops) ?? this.movementBearing(report);
    }

    private nextStopBearing(report: DukVehicleReport, stops: TripStation[]): number | null {
        const passed = this.lastPassedIndex(report, stops);
        if (passed === null) return null;
        for (const stop of stops.slice(passed + 1)) {
            if (!isLocated(stop)) continue;
            const [lon, lat] = stop.coordinates;
            if (distanceMeters(report.latitude, report.longitude, lat, lon) < DUK_CONFIG.BEARING_MIN_MOVE_M) continue;
            return bearingDeg(report.latitude, report.longitude, lat, lon);
        }
        return null;
    }

    /**
     * Index in `stops` of the last stop the vehicle has passed, -1 before its first, null when unknown.
     * The feed reports it by node, which a loop visits twice; the visit due now is meant.
     */
    private lastPassedIndex(report: DukVehicleReport, stops: TripStation[]): number | null {
        if (report.stationNode === null) return null;
        const prefix = `${report.stationNode}-`;
        const dueSecs = getLocalClock(this.city.timezone).secs - (report.delay ?? 0);
        let reported = -1;
        let closestGap = Infinity;
        stops.forEach((stop, i) => {
            if (!stop.id.startsWith(prefix)) return;
            const gap = Math.abs(wrapDaySeconds(toSecs(stop.departure_time) - dueSecs));
            if (gap < closestGap) { closestGap = gap; reported = i; }
        });
        if (reported < 0) return null;
        // Before its trip, the reported node is the first stop, still to come.
        return isBeforeTrip(report) ? reported - 1 : this.legStartNear(report, stops, reported);
    }

    /**
     * The reported stop moved to the start of the leg a moving vehicle actually lies on: the feed
     * announces a stop ahead before reaching it and misses some it passes.
     */
    private legStartNear(report: DukVehicleReport, stops: TripStation[], reported: number): number {
        if (report.state === null || DUK_STATE_MAPPING[report.state] !== 'on_track') return reported;
        const located: number[] = [];
        stops.forEach((stop, i) => { if (isLocated(stop)) located.push(i); });
        const at = located.indexOf(reported);
        // An arrival at the last stop stands; buses lay over away from the stop post.
        if (at < 0 || at === located.length - 1) return reported;

        const { latitude: lat, longitude: lon } = report;
        const [sLon, sLat] = stops[reported].coordinates;
        if (distanceMeters(lat, lon, sLat, sLon) < DUK_CONFIG.AT_STOP_RADIUS_M) return reported;
        const legDistance = (k: number) => {
            if (k < 0 || k + 1 >= located.length) return Infinity;
            const [aLon, aLat] = stops[located[k]].coordinates;
            const [bLon, bLat] = stops[located[k + 1]].coordinates;
            return distanceToSegmentMeters(lat, lon, aLat, aLon, bLat, bLon);
        };

        const reportedDistance = legDistance(at);
        let best = at;
        let bestDistance = Math.min(reportedDistance - DUK_CONFIG.APPROACH_LEG_MARGIN_M, DUK_CONFIG.MAX_ROUTE_DISTANCE_M);
        for (let k = at - 1; k <= at + DUK_CONFIG.MAX_SKIPPED_STOPS; k++) {
            if (k === at) continue;
            const distance = legDistance(k);
            if (distance < bestDistance) { bestDistance = distance; best = k; }
        }
        return located[best];
    }

    private legBearing(report: DukVehicleReport, stops: TripStation[]): number | null {
        const located = stops.filter(isLocated);
        let best: number | null = null;
        let bestDistance: number = DUK_CONFIG.MAX_ROUTE_DISTANCE_M;
        for (let i = 1; i < located.length; i++) {
            const [aLon, aLat] = located[i - 1].coordinates;
            const [bLon, bLat] = located[i].coordinates;
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
    override async getSingleLiveVehicle(vehicleId: string, gtfsTripId?: string): Promise<{ liveMatch?: AppVehicleFeature, lastStopId?: string }> {
        const { liveMatch } = await super.getSingleLiveVehicle(vehicleId, gtfsTripId);
        const tripId = liveMatch?.properties.gtfs_trip_id;
        const liveVehicleId = liveMatch?.properties.vehicle_id;
        if (!liveMatch || !tripId || !liveVehicleId) return { liveMatch };

        const [reports, stops] = await Promise.all([
            getDukTrafficFeed(this.city).catch(() => null),
            getTripStops(this.city, tripId),
        ]);
        const report = reports ? getReportIndex(reports).get(liveVehicleId) : undefined;
        const passed = report ? this.lastPassedIndex(report, stops) : null;
        if (passed === null || passed < 0) return { liveMatch };

        return { liveMatch: { ...liveMatch, properties: { ...liveMatch.properties, last_stop_sequence: passed + 1 } } };
    }

    /**
     * Detail for a vehicle the static data has no trip for: its live state plus the last reached and
     * final stop, with gaps marking the unknown rest of the route.
     */
    async getLiveOnlyDetail(vehicleId: string | null, tripId: string | null): Promise<AppVehicleDetail | null> {
        const collection = await this.getCachedMappedVehicles();
        const feature = collection.features.find(f =>
            (vehicleId && f.properties.vehicle_id === vehicleId) || (tripId && f.properties.gtfs_trip_id === tripId)
        );
        if (!feature?.properties.vehicle_id) return null;

        const [reports, stationNames] = await Promise.all([
            getDukTrafficFeed(this.city).catch(() => null),
            getDukStationNames(this.city),
        ]);
        const report = reports ? getReportIndex(reports).get(feature.properties.vehicle_id) : undefined;

        const features: NonNullable<AppVehicleDetail['stop_times']>['features'] = [];
        const localTime = (ms: number | null) => (ms === null ? '' : formatTime(new Date(ms), this.city.timezone));
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
            route_geojson: undefined,
        };
    }
}
