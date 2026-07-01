import type { EventContext } from "@cloudflare/workers-types";
import type { CityConfig } from '../../../_core/city-config';
import type { Env, AppVehicleCollection, AppVehicleFeature } from "../../../_core/types";
import type { ApiTrip, ApiMapping, ArcgisResponse, ArcgisFeature } from './types';
import { CacheManager, CACHE_TTL } from '../../../_core/utils/CacheManager';
import { getGtfsData, GtfsRoute, GtfsData } from '../../gtfs/core/gtfs-data';
import { parseSearchParams, vehicleQuerySchema } from '../../../_core/schemas';
import { getDpmbVehicleMetadata } from '../utils/dpmbVehicleMetadata';


export class KordisVehiclesService {
    constructor(private city: CityConfig) {}

    /**
     * Resolves the current active trip_id and statePosition from raw ApiTrip info using optimized on-demand parsing
     */
    private resolveActiveTrip(
        trips: ApiTrip[] | undefined, 
        currentMinutes: number, 
        todayLocalStr: string, 
        delaySecs: number,
        hasLastStopId: boolean
    ): { tripId: string | null; statePosition: string } {
        const defaultState = hasLastStopId ? 'in_transit_to' : 'stopped_at';
        if (!trips || trips.length === 0) return { tripId: null, statePosition: defaultState };

        const parseTimeToMinutes = (timeStr: string) => {
            const h = parseInt(timeStr.substring(0, 2), 10);
            const m = parseInt(timeStr.substring(3, 5), 10);
            return h * 60 + m;
        };

        const BUFFER_MINS = 15;
        let matchedTrip: ApiTrip | null = null;
        let closestTrip: ApiTrip = trips[0];
        let minDiff = Infinity;

        for (const trip of trips) {
            if (!trip.start || !trip.end) continue;

            const startMins = parseTimeToMinutes(trip.start);
            const delayMinutes = delaySecs / 60;
            
            const startMinsWithBuffer = startMins - BUFFER_MINS;
            let endMinsWithBuffer = parseTimeToMinutes(trip.end) + delayMinutes + BUFFER_MINS;
            
            if (endMinsWithBuffer < startMinsWithBuffer) endMinsWithBuffer += 24 * 60;
            const checkMins = currentMinutes < startMinsWithBuffer ? currentMinutes + 24 * 60 : currentMinutes;

            const runsToday = !trip.dates || trip.dates.includes(todayLocalStr);

            if (checkMins >= startMinsWithBuffer && checkMins <= endMinsWithBuffer && runsToday) {
                matchedTrip = trip;
                break;
            }

            // Calculate distance to this trip if no exact match is found
            const dist = Math.min(Math.abs(checkMins - startMinsWithBuffer), Math.abs(checkMins - endMinsWithBuffer));
            if (dist < minDiff && runsToday) {
                minDiff = dist;
                closestTrip = trip;
            }
        }

        const finalTrip = matchedTrip || closestTrip;
        if (!finalTrip) return { tripId: null, statePosition: defaultState };

        // Determine if vehicle is currently running before the scheduled start time of this trip
        const tripStartMins = parseTimeToMinutes(finalTrip.start);
        const checkMinsForStart = currentMinutes < tripStartMins - BUFFER_MINS ? currentMinutes + 24 * 60 : currentMinutes;
        
        let statePosition = defaultState;
        if (checkMinsForStart < tripStartMins) {
            statePosition = delaySecs > 60 ? 'before_track_delayed' : 'before_track';
        }

        return { tripId: finalTrip.trip_id, statePosition };
    }

    async getRawVehicles(): Promise<ArcgisResponse> {
        return CacheManager.getOrFetch(
            `vehicles_live_raw_${this.city.slug}`,
            10000,
            async () => {
                const arcgisConfigUrl = this.city.adapterConfig?.realtimeArcgisUrl;
                if (!arcgisConfigUrl) {
                    throw new Error(`Missing KORDIS ArcGIS configuration.`);
                }
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8500);
                try {
                    const resArcgis = await fetch(arcgisConfigUrl, { 
                        cf: { cacheTtl: 10 },
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);
                    if (!resArcgis.ok) {
                        return { features: [] };
                    }
                    return await resArcgis.json() as ArcgisResponse;
                } catch (e) {
                    clearTimeout(timeoutId);
                    console.error("KORDIS ArcGIS fetch timed out or failed:", e);
                    return { features: [] };
                }
            }
        );
    }

    private resolveRoute(
        attr: ArcgisFeature['attributes'],
        tripId: string | null,
        gtfsData: GtfsData
    ): GtfsRoute | null {
        const { routes, tripRoutes, routesByName } = gtfsData;
        const routeInfo = tripId && tripRoutes ? tripRoutes[tripId] : null;
        const routeId = routeInfo ? routeInfo.split('|')[0] : null;
        let route = routeId && routes ? routes[routeId] : null;
        
        // Fallback: If trip matching fails (because Kordis didn't map this course), pull the route directly from GTFS by LineName
        if (!route && attr.LineName) {
            const cleanLineName = String(attr.LineName).trim().toUpperCase();
            route = routesByName[cleanLineName] || null;
        }
        return route || null;
    }

    private mapVehicle(
        attr: ArcgisFeature['attributes'], 
        tripId: string | null, 
        route: GtfsRoute | null, 
        delay: number,
        statePosition: string
    ): AppVehicleFeature {
        const routeColor = route?.route_color ? (route.route_color.startsWith('#') ? route.route_color : `#${route.route_color}`) : '#4b5563';
        const rType = route ? Number(route.type) : ([0, 1, 11, 3, 4, 2][attr.VType] ?? 3);
        
        const lineName = attr.LineName || '?';
        const finalLineName = route?.short_name || route?.name || lineName;

        const metadata = getDpmbVehicleMetadata(attr.ID);

        return {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [attr.Lng, attr.Lat] // GeoJSON format is [Lng, Lat]
            },
            properties: {
                vehicle_id: attr.ID.toString(),
                gtfs_trip_id: tripId || '',
                route_short_name: finalLineName,
                route_type: rType,
                trip_headsign: 'Unknown',
                bearing: attr.Bearing || null,
                delay: delay,
                state_position: statePosition,
                run_number: attr.Course || undefined,
                vehicle_descriptor: {
                    operator: 'IDS JMK',
                    vehicle_registration_number: attr.ID.toString(),
                    is_wheelchair_accessible: attr.LF === 'true',
                    vehicle_type: metadata?.vehicle_type || undefined,
                    is_air_conditioned: metadata?.is_air_conditioned !== undefined ? metadata.is_air_conditioned : undefined
                },
                origin_timestamp: new Date(attr.TimeUpdated).toISOString(),
                is_static_fallback: false,
                route_color: routeColor,
                is_night: false
            }
        };
    }


    async getVehicles(ctx: EventContext<Env, string, unknown>): Promise<AppVehicleCollection> {
        const allVehicles = await CacheManager.getOrFetch<AppVehicleCollection>(
            `kordis_vehicles_${this.city.slug}`, 
            CACHE_TTL.TEN_SECONDS_MS, 
            async () => {
                const staticUrl = this.city.adapterConfig?.staticDataUrl;
                if (!staticUrl) {
                    throw new Error(`Missing KORDIS Static URL configuration.`);
                }
                const apiUrl = `${staticUrl}/${this.city.slug}/api.json`;

                const [apiMapping, arcgisData, gtfsData] = await Promise.all([
                    CacheManager.getOrFetch<ApiMapping | null>(
                        `api_mapping_${this.city.slug}`, 
                        CACHE_TTL.TWO_HOURS_MS, 
                        async () => {
                            const resApi = await fetch(apiUrl, { cf: { cacheTtl: 7200 } });
                            if (!resApi.ok) return null;
                            return await resApi.json() as ApiMapping;
                        }
                    ),
                    this.getRawVehicles(),
                    getGtfsData(this.city.slug)
                ]);

                if (!arcgisData?.features || arcgisData.features.length === 0 || !apiMapping) {
                    return { type: 'FeatureCollection', features: [] };
                }

                const tzFormatter = new Intl.DateTimeFormat('en-US', {
                    timeZone: 'Europe/Prague',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                });
                const parts = tzFormatter.formatToParts(new Date());
                const y = parts.find(p => p.type === 'year')?.value || '';
                const m = parts.find(p => p.type === 'month')?.value || '';
                const d = parts.find(p => p.type === 'day')?.value || '';
                const hh = parts.find(p => p.type === 'hour')?.value || '0';
                const mm = parts.find(p => p.type === 'minute')?.value || '0';
                const ss = parts.find(p => p.type === 'second')?.value || '0';

                const todayLocalStr = `${y}${m}${d}`;
                const currentMinutes = Number(hh) * 60 + Number(mm) + Number(ss) / 60;

                const features: AppVehicleFeature[] = [];
                const THRESHOLD_MS = 20 * 60 * 1000;
                const nowMs = Date.now();
                const seenVehicles = new Set<string>();

                for (const feature of arcgisData.features) {
                    const attr = feature.attributes;
                    
                    if (nowMs - attr.TimeUpdated > THRESHOLD_MS) continue;
                    if (attr.IsInactive === 'true') continue;

                    const vehicleIdStr = attr.ID.toString();
                    if (seenVehicles.has(vehicleIdStr)) continue;
                    seenVehicles.add(vehicleIdStr);

                    const delay = (attr.Delay || 0) * 60; // Convert minutes to seconds
                    
                    const tripsForCourse = apiMapping[`${attr.LineID}-${attr.RouteID}`];
                    const { tripId, statePosition } = this.resolveActiveTrip(tripsForCourse, currentMinutes, todayLocalStr, delay, !!attr.LastStopID);
 
                    const route = this.resolveRoute(attr, tripId, gtfsData);
                    features.push(this.mapVehicle(attr, tripId, route, delay, statePosition));
                }

                const result: AppVehicleCollection = { type: 'FeatureCollection', features };

                try {
                    const cache = caches.default;
                    const jsonCacheKey = new Request(`https://departs.app/cache/${this.city.slug}/vehicles_v1`, { method: 'GET' });
                    const responseToCache = new Response(JSON.stringify(result), {
                        headers: { 
                            'Content-Type': 'application/json', 
                            'Cache-Control': 'public, max-age=30, s-maxage=30' 
                        }
                    });
                    await cache.put(jsonCacheKey, responseToCache);
                } catch (e) {
                    console.error("Failed to populate departures vehicles cache:", e);
                }

                return result;
            }
        );

        const { searchParams } = new URL(ctx.request.url);
        const { routeType: routeTypes, routeShortName: routeShortNames, bounds } = parseSearchParams(searchParams, vehicleQuerySchema);
        
        let filteredFeatures = allVehicles.features;

        if (bounds) {
            const [minLat, minLng, maxLat, maxLng] = bounds.split(',').map(Number);
            if (!isNaN(minLat) && !isNaN(minLng) && !isNaN(maxLat) && !isNaN(maxLng)) {
                filteredFeatures = filteredFeatures.filter(f => {
                    const coords = f.geometry?.coordinates;
                    if (!coords) return false;
                    const [lng, lat] = coords;
                    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
                });
            }
        }

        if (routeTypes.length > 0) {
            filteredFeatures = filteredFeatures.filter(f => {
                const rt = Number(f.properties.route_type);
                return routeTypes.some(t => {
                    const type = t.toLowerCase();
                    if (type === 'tram') return rt === 0 || (rt >= 900 && rt <= 999);
                    if (type === 'metro') return rt === 1 || (rt >= 400 && rt <= 499);
                    if (type === 'train') return rt === 2 || (rt >= 100 && rt <= 199);
                    if (type === 'bus') return rt === 3 || (rt >= 700 && rt <= 799);
                    if (type === 'ferry') return rt === 4 || (rt >= 1000 && rt <= 1099);
                    if (type === 'funicular') return rt === 7 || (rt >= 1400 && rt <= 1499);
                    if (type === 'trolleybus') return rt === 11 || (rt >= 800 && rt <= 899);
                    return false;
                });
            });
        }

        if (routeShortNames.length > 0) {
            // Frontend might send '2', 'N93' etc. `routeShortNames` is already sanitized.
            const upperRouteShortNames = routeShortNames.map(name => name.toUpperCase());
            filteredFeatures = filteredFeatures.filter(f => upperRouteShortNames.includes(f.properties.route_short_name.toUpperCase()));
        }

        return { type: 'FeatureCollection', features: filteredFeatures };
    }
}
