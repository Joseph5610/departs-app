import { transit_realtime } from 'gtfs-realtime-bindings';
import type { AppVehicleCollection, AppVehicleFeature } from '../../../../_core/types';
import { CacheManager, CACHE_TTL } from '../../../../_core/utils/CacheManager';
import { LruCache } from '../../../../_core/utils/LruCache';
import { VehiclesService } from '../../../gtfs/services/vehicles/VehiclesService';
import { VehiclesMapper } from '../../../gtfs/services/vehicles/VehiclesMapper';
import { getGtfsRoutes, getGtfsTripRoutes, type GtfsRoute } from '../../../gtfs/core/gtfs-data';
import { getTripWindows } from '../../../gtfs/core/trip-windows';
import { getTripStops } from '../../../gtfs/core/trip-stops';
import { getVehicleRanges, findVehicleRange, type VehicleRange } from '../../../gtfs/core/vehicle-ranges';
import { GTFS_CONFIG } from '../../../gtfs/core/config';
import { getCurrentLocalSeconds, getZonedDateString, zonedLocalToEpochMs } from '../../../gtfs/core/utils';
import { DPMP_CONFIG } from '../../core/config';
import { getDpmpCsvFeed, type DpmpVehicleRow } from '../../core/dpmp-csv-feed';
import { DpmpTripMatcher, type MatchContext } from './DpmpTripMatcher';

const { VehicleStopStatus } = transit_realtime.VehiclePosition;

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

/** Last position per vehicle, so a heading can be derived from movement - the CSV has none. */
const lastFixes = new LruCache<LastFix>({ maxEntries: DPMP_CONFIG.BEARING_CACHE_MAX_ENTRIES });

function distanceM(aLat: number, aLon: number, bLat: number, bLon: number): number {
    const toRad = (x: number) => x * Math.PI / 180;
    const dLat = toRad(bLat - aLat);
    const dLon = toRad(bLon - aLon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
    return 6_371_000 * 2 * Math.asin(Math.sqrt(h));
}

function bearingDeg(aLat: number, aLon: number, bLat: number, bLon: number): number {
    const toRad = (x: number) => x * Math.PI / 180;
    const y = Math.sin(toRad(bLon - aLon)) * Math.cos(toRad(bLat));
    const x = Math.cos(toRad(aLat)) * Math.sin(toRad(bLat)) - Math.sin(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.cos(toRad(bLon - aLon));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

const DAY_MS = 86_400_000;

/**
 * Epoch ms of a CSV `DATE_TIME`. Only its time of day is trusted: after midnight DPMP keeps
 * stamping the previous operating day's date, so the time is placed at its occurrence nearest now.
 */
function reportTimeMs(dateTime: string, nowMs: number, timezone: string): number | null {
    const time = /(\d{2}:\d{2}(?::\d{2})?)\s*$/.exec(dateTime)?.[1];
    if (!time) return null;

    const today = getZonedDateString(timezone);
    const atMs = zonedLocalToEpochMs(`${today.slice(0, 4)}-${today.slice(4, 6)}-${today.slice(6, 8)} ${time}`, timezone);
    if (atMs === null) return null;

    if (atMs - nowMs > DAY_MS / 2) return atMs - DAY_MS;
    if (nowMs - atMs > DAY_MS / 2) return atMs + DAY_MS;
    return atMs;
}

/** YYYYMMDD of the day before `dayStr`. */
function previousDayStr(dayStr: string): string {
    const d = new Date(Date.UTC(Number(dayStr.slice(0, 4)), Number(dayStr.slice(4, 6)) - 1, Number(dayStr.slice(6, 8)) - 1));
    return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Vehicles for Prešov, built from the DPMP realtime CSV rather than a GTFS-RT feed.
 *
 * Rows are matched to GTFS trips by schedule (see DpmpTripMatcher). Rows that match no trip -
 * depot and positioning runs, or lines absent from the timetable - are still surfaced, as
 * `off_track` vehicles with an empty trip id.
 */
export class DpmpVehiclesService extends VehiclesService {
    private realtimeUrlOverride: string | undefined;

    /** Routes the CSV fetch through `url` instead of the configured upstream. */
    setRealtimeUrlOverride(url: string | undefined): void {
        this.realtimeUrlOverride = url;
    }

    /** The GTFS-RT feed does not exist here; the base raw-entity lookup is skipped by returning none. */
    protected override async getCoreData() {
        return Promise.all([
            null,
            getGtfsRoutes(this.city.slug),
            getGtfsTripRoutes(this.city.slug),
        ]);
    }

    override async getCachedMappedVehicles(): Promise<AppVehicleCollection> {
        return CacheManager.getOrFetch<AppVehicleCollection>(
            `dpmp_vehicles_collection_${this.city.slug}`,
            CACHE_TTL.SHORT_DEBOUNCE_MS,
            async () => {
                const [rows, routes, tripRoutes, windows, fleet] = await Promise.all([
                    getDpmpCsvFeed(this.city, this.realtimeUrlOverride).catch((err) => {
                        console.error(`DPMP feed error for ${this.city.slug}:`, err.message);
                        return null;
                    }),
                    getGtfsRoutes(this.city.slug),
                    getGtfsTripRoutes(this.city.slug),
                    getTripWindows(this.city),
                    getVehicleRanges(this.city),
                ]);

                if (!rows) {
                    return { type: 'FeatureCollection', features: [], status: 'upstream_offline' };
                }

                const todayStr = getZonedDateString(this.city.timezone);
                const ctx: MatchContext = {
                    todayStr,
                    yesterdayStr: previousDayStr(todayStr),
                    nowMins: getCurrentLocalSeconds(this.city.timezone) / 60,
                };
                const matcher = windows ? new DpmpTripMatcher(this.city, windows, routes, tripRoutes) : null;
                const nowMs = Date.now();

                const latestByVehicle = new Map<string, { row: DpmpVehicleRow; timestampMs: number }>();
                for (const row of rows) {
                    const timestampMs = reportTimeMs(row.dateTime, nowMs, this.city.timezone) ?? nowMs;
                    if (nowMs - timestampMs > GTFS_CONFIG.VEHICLES_STALE_THRESHOLD_MS) continue;
                    const existing = latestByVehicle.get(row.vehicleNumber);
                    if (!existing || existing.timestampMs < timestampMs) {
                        latestByVehicle.set(row.vehicleNumber, { row, timestampMs });
                    }
                }

                const mapped = await Promise.all(
                    Array.from(latestByVehicle.values(), ({ row, timestampMs }) =>
                        this.mapRow(row, timestampMs, matcher, ctx, routes.routesByName)
                    )
                );
                const features: AppVehicleFeature[] = [];
                for (const feature of mapped) {
                    if (feature) features.push(this.withFleetMetadata(feature, fleet));
                }

                return { type: 'FeatureCollection', features, status: 'ok' };
            },
            (col) => !col || col.status === 'upstream_offline' || !col.features || col.features.length === 0
        );
    }

    private async mapRow(
        row: DpmpVehicleRow,
        timestampMs: number,
        matcher: DpmpTripMatcher | null,
        ctx: MatchContext,
        routesByName: Record<string, GtfsRoute>
    ): Promise<AppVehicleFeature | null> {
        const match = matcher ? await matcher.match(row, ctx) : null;

        // Without a GPS fix the row still carries delay and stop progress, which only a trip can place.
        const position = row.latitude !== null && row.longitude !== null
            ? { latitude: row.latitude, longitude: row.longitude, bearing: this.resolveBearing(row.vehicleNumber, row.latitude, row.longitude) }
            : match ? await this.estimatePosition(match.tripId, row) : null;
        if (!position) return null;

        const route: GtfsRoute = routesByName[row.routeNumber]
            ?? { name: row.routeNumber, type: DPMP_CONFIG.FALLBACK_ROUTE_TYPE, route_color: '' };

        const vp: transit_realtime.IVehiclePosition = {
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

        const minsToStart = match.startRelMins - ctx.nowMins;
        const isBeforeTrack = row.stopOrder <= 1 && minsToStart > 1 && minsToStart <= GTFS_CONFIG.BEFORE_TRACK_WINDOW_MINS;

        return VehiclesMapper.mapVehicle(vp, match.tripId, route, originTimestamp, -row.variation, isBeforeTrack);
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
        if (distanceM(prev.lat, prev.lon, lat, lon) < DPMP_CONFIG.BEARING_MIN_MOVE_M) {
            return prev.bearing;
        }
        const bearing = bearingDeg(prev.lat, prev.lon, lat, lon);
        lastFixes.set(key, { lat, lon, bearing });
        return bearing;
    }
}
