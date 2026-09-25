import * as GtfsRt from '../../../_core/gtfsRtTypes';
import type { AppVehicleCollection, AppVehicleFeature } from '../../../_core/types';
import type { CityConfig } from '../../../_core/city-config';
import { deriveAsync, type Derivation, type Snapshot } from '../../../_core/feed/source';
import { LruCache } from '../../../_core/feed/LruCache';
import type { VehicleSource } from '../../gtfs/vehicles/vehicle-source';
import { VehiclesMapper } from '../../gtfs/vehicles/VehiclesMapper';
import { getGtfsRoutes, getGtfsTripRoutes, type GtfsRoute } from '../../../_feeds/gtfs/gtfs-data';
import { getTripWindows } from '../../../_feeds/gtfs/trip-windows';
import { getTripStops } from '../../../_feeds/gtfs/trip-stops';
import { getVehicleRanges, findVehicleRange, type VehicleRange } from '../../../_feeds/gtfs/vehicle-ranges';
import { GTFS_CONFIG } from '../../../_feeds/gtfs/config';
import { DAY_MS, getLocalClock, zonedLocalToEpochMs, type LocalClock } from '../../../_core/utils/time';
import { bearingDeg, distanceMeters } from '../../../_core/utils/geo';
import { DPMP_CONFIG } from '../../../_feeds/dpmp/config';
import { getDpmpCsvSnapshot, type DpmpVehicleRow } from '../../../_feeds/dpmp/dpmp-csv-feed';
import { DpmpTripMatcher } from './DpmpTripMatcher';

const { VehicleStopStatus } = GtfsRt;

const OFFLINE: AppVehicleCollection = { type: 'FeatureCollection', features: [], status: 'upstream_offline' };

/** The mapped fleet per CSV snapshot: built once per feed read, however many requests read it. */
const collections = new WeakMap<object, Derivation<AppVehicleCollection>>();

interface Position {
    latitude: number;
    longitude: number;
    bearing: number | null;
}

interface LastFix {
    lat: number;
    lon: number;
    bearing: number | null;
}

interface SeenRow {
    row: DpmpVehicleRow;
    timestampMs: number;
    /** When the row was last present in the CSV; remembered copies do not refresh it. */
    seenAtMs: number;
}

/** Last CSV row per vehicle and city, to bridge the export's short per-vehicle dropouts. */
const lastSeenRows = new Map<string, Map<string, SeenRow>>();

/** Last position per vehicle, so a heading can be derived from movement - the CSV has none. */
const lastFixes = new LruCache<LastFix>({ maxEntries: DPMP_CONFIG.BEARING_CACHE_MAX_ENTRIES });

/**
 * Epoch ms of a CSV `DATE_TIME`. Only its time of day is trusted: after midnight DPMP keeps
 * stamping the previous operating day's date, so the time is placed at its occurrence nearest now.
 */
function reportTimeMs(dateTime: string, nowMs: number, timezone: string): number | null {
    const time = /(\d{2}:\d{2}(?::\d{2})?)\s*$/.exec(dateTime)?.[1];
    if (!time) return null;

    const today = getLocalClock(timezone, nowMs).date;
    const atMs = zonedLocalToEpochMs(`${today.slice(0, 4)}-${today.slice(4, 6)}-${today.slice(6, 8)} ${time}`, timezone);
    if (atMs === null) return null;

    if (atMs - nowMs > DAY_MS / 2) return atMs - DAY_MS;
    if (nowMs - atMs > DAY_MS / 2) return atMs + DAY_MS;
    return atMs;
}

/**
 * Vehicles for Prešov, built from the DPMP realtime CSV rather than a GTFS-RT feed.
 *
 * Rows are matched to GTFS trips by schedule (see DpmpTripMatcher). Rows that match no trip -
 * depot and positioning runs, or lines absent from the timetable - are still surfaced, as
 * `off_track` vehicles with an empty trip id.
 */
export class DpmpVehicleSource implements VehicleSource {
    /** `realtimeUrl` replaces the configured upstream (local dev's relay, via `env.DPMP_REALTIME_URL`). */
    constructor(
        private readonly city: CityConfig,
        private readonly realtimeUrl?: string
    ) {}

    /** The fleet of the latest CSV snapshot; a failed read keeps serving the last good one. */
    async all(): Promise<AppVehicleCollection> {
        const snapshot = await getDpmpCsvSnapshot(this.city, this.realtimeUrl).catch((err) => {
            console.error(`DPMP feed error for ${this.city.slug}:`, err.message);
            return null;
        });
        if (!snapshot) return OFFLINE;
        return deriveAsync(snapshot, collections, () => this.build(snapshot));
    }

    private async build(snapshot: Snapshot<DpmpVehicleRow[]>): Promise<AppVehicleCollection> {
        const rows = snapshot.data;
        const [routes, tripRoutes, windows, fleet] = await Promise.all([
            getGtfsRoutes(this.city),
            getGtfsTripRoutes(this.city),
            getTripWindows(this.city),
            getVehicleRanges(this.city),
        ]);

        const ctx = getLocalClock(this.city.timezone);
        const matcher = windows ? new DpmpTripMatcher(this.city, windows, routes, tripRoutes) : null;
        const nowMs = Date.now();

        const latestByVehicle = new Map<string, SeenRow>();
        for (const row of rows) {
            const timestampMs = reportTimeMs(row.dateTime, nowMs, this.city.timezone) ?? nowMs;
            if (nowMs - timestampMs > GTFS_CONFIG.VEHICLES_STALE_THRESHOLD_MS) continue;
            const existing = latestByVehicle.get(row.vehicleNumber);
            if (!existing || existing.timestampMs < timestampMs) {
                latestByVehicle.set(row.vehicleNumber, { row, timestampMs, seenAtMs: nowMs });
            }
        }
        this.bridgeDropouts(latestByVehicle, nowMs);

        const mapped = await Promise.all(
            Array.from(latestByVehicle.values(), ({ row, timestampMs }) =>
                this.mapRow(row, timestampMs, matcher, ctx, routes.routesByName)
            )
        );
        const features: AppVehicleFeature[] = [];
        for (const feature of mapped) {
            if (feature) features.push(this.withFleetMetadata(feature, fleet));
        }

        return { type: 'FeatureCollection', features, last_updated: new Date(nowMs).toISOString() };
    }

    private async mapRow(
        row: DpmpVehicleRow,
        timestampMs: number,
        matcher: DpmpTripMatcher | null,
        ctx: LocalClock,
        routesByName: Record<string, GtfsRoute>
    ): Promise<AppVehicleFeature | null> {
        const match = matcher ? await matcher.match(row, ctx) : null;

        // Without a GPS fix the row still carries delay and stop progress, which only a trip can place.
        const position = row.latitude !== null && row.longitude !== null
            ? { latitude: row.latitude, longitude: row.longitude, bearing: this.resolveBearing(row.vehicleNumber, row.latitude, row.longitude) }
            : match ? await this.estimatePosition(match.tripId, row) : null;
        if (!position) return null;

        const route: GtfsRoute = routesByName[row.routeNumber]
            ?? { name: row.routeNumber, type: DPMP_CONFIG.FALLBACK_ROUTE_TYPE };

        const vp: GtfsRt.IVehiclePosition = {
            position: {
                latitude: position.latitude,
                longitude: position.longitude,
                bearing: position.bearing ?? undefined,
            },
            currentStatus: row.realRoad === 0 ? VehicleStopStatus.STOPPED_AT : VehicleStopStatus.IN_TRANSIT_TO,
            currentStopSequence: row.stopOrder,
            timestamp: Math.floor(timestampMs / 1000),
            vehicle: { id: row.vehicleNumber, label: row.vehicleNumber },
        };

        const originTimestamp = new Date(timestampMs).toISOString();

        if (!match) {
            const feature = VehiclesMapper.mapVehicle(vp, '', route, originTimestamp, null);
            feature.properties.state_position = 'off_track';
            return feature;
        }

        const minsToStart = match.startRelMins - ctx.mins;
        const isBeforeTrack = row.stopOrder <= 1 && minsToStart > 1 && minsToStart <= GTFS_CONFIG.BEFORE_TRACK_WINDOW_MINS;

        return VehiclesMapper.mapVehicle(vp, match.tripId, route, originTimestamp, -row.variation, isBeforeTrack);
    }

    /**
     * Re-adds vehicles that dropped out of this CSV snapshot but were present within
     * DROPOUT_GRACE_MS, then records the merged set for the next build.
     */
    private bridgeDropouts(latestByVehicle: Map<string, SeenRow>, nowMs: number): void {
        let remembered = lastSeenRows.get(this.city.slug);
        if (!remembered) {
            remembered = new Map();
            lastSeenRows.set(this.city.slug, remembered);
        }

        for (const [vehicleNumber, seen] of remembered) {
            const expired = nowMs - seen.seenAtMs > DPMP_CONFIG.DROPOUT_GRACE_MS
                || nowMs - seen.timestampMs > GTFS_CONFIG.VEHICLES_STALE_THRESHOLD_MS;
            if (expired) {
                remembered.delete(vehicleNumber);
            } else if (!latestByVehicle.has(vehicleNumber)) {
                latestByVehicle.set(vehicleNumber, seen);
            }
        }

        for (const [vehicleNumber, seen] of latestByVehicle) {
            remembered.set(vehicleNumber, seen);
        }
    }

    /** Adds the operator and, when the side number is in the fleet register, model and equipment. */
    private withFleetMetadata(feature: AppVehicleFeature, fleet: VehicleRange[] | null): AppVehicleFeature {
        const vehicleNumber = Number(feature.properties.vehicle_id);
        const range = fleet && Number.isFinite(vehicleNumber) ? findVehicleRange(vehicleNumber, fleet) : null;

        feature.properties.vehicle_descriptor = {
            ...feature.properties.vehicle_descriptor,
            operator: DPMP_CONFIG.OPERATOR,
            ...(range ? {
                vehicle_type: range.vehicle_type,
                is_air_conditioned: range.is_air_conditioned === true,
                is_wheelchair_accessible: range.is_wheelchair_accessible === true,
            } : {}),
        };
        return feature;
    }

    /**
     * Places a vehicle with no GPS fix on its current stop segment, advanced by the share of the
     * segment it reports having driven (`REAL_ROAD` / `PLANNED_ROAD`).
     */
    private async estimatePosition(tripId: string, row: DpmpVehicleRow): Promise<Position | null> {
        const stops = await getTripStops(this.city, tripId);
        const from = stops[row.stopOrder - 1];
        if (!from || (from.coordinates[0] === 0 && from.coordinates[1] === 0)) return null;

        const to = stops[row.stopOrder] ?? from;
        const t = row.plannedRoad > 0 ? Math.min(Math.max(row.realRoad / row.plannedRoad, 0), 1) : 0;
        const [fromLon, fromLat] = from.coordinates;
        const [toLon, toLat] = to.coordinates;

        return {
            latitude: fromLat + (toLat - fromLat) * t,
            longitude: fromLon + (toLon - fromLon) * t,
            bearing: to === from ? null : bearingDeg(fromLat, fromLon, toLat, toLon),
        };
    }

    private resolveBearing(vehicleNumber: string, lat: number, lon: number): number | null {
        const key = `${this.city.slug}:${vehicleNumber}`;
        const prev = lastFixes.get(key);
        if (!prev) {
            lastFixes.set(key, { lat, lon, bearing: null });
            return null;
        }
        if (distanceMeters(prev.lat, prev.lon, lat, lon) < DPMP_CONFIG.BEARING_MIN_MOVE_M) {
            return prev.bearing;
        }
        const bearing = bearingDeg(prev.lat, prev.lon, lat, lon);
        lastFixes.set(key, { lat, lon, bearing });
        return bearing;
    }
}
