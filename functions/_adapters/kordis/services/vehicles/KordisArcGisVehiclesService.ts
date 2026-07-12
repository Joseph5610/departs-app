import type { EventContext } from "@cloudflare/workers-types";
import type { CityConfig } from '../../../../_core/city-config';
import type { Env, AppVehicleCollection, AppVehicleFeature } from "../../../../_core/types";
import type { ApiTrip, ApiMapping, ArcgisResponse, ArcgisFeature } from '../types';
import { CacheManager, CACHE_TTL } from '../../../../_core/utils/CacheManager';
import { getGtfsData, GtfsRoute, GtfsData } from '../../../gtfs/core/gtfs-data';
import { appClient } from '../../../../_core/ApiClient';
import { parseSearchParams, vehicleQuerySchema } from '../../../../_core/schemas';

const PRAGUE_TZ_FORMATTER = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
});

/**
 * Legacy vehicle service for Brno using the older ArcGIS endpoint.
 * This fetches raw live vehicle locations for all of Brno from a non-GTFS-RT source.
 * It manually correlates the ArcGIS data with the GTFS static schedule using Kordis-specific mapping rules.
 * Currently, this is bypassed in favor of the standard GTFS-RT feed (unless USE_GTFS_RT is set to false).
 */
export class KordisArcGisVehiclesService {
    constructor(private city: CityConfig) {}

    /**
     * Resolves the current active trip_id and statePosition from raw ApiTrip info using optimized on-demand parsing
     */
    private resolveActiveTrip(
        trips: ApiTrip[] | undefined, 
        currentMinutes: number, 
        todayLocalStr: string, 
        delaySecs: number | null,
        hasLastStopId: boolean
    ): { tripId: string | null; statePosition: string } {
        const defaultState = hasLastStopId ? 'in_transit_to' : 'stopped_at';
        if (!trips || trips.length === 0) return { tripId: null, statePosition: defaultState };

        const BUFFER_MINS = 15;
        let matchedTrip: ApiTrip | null = null;
        let closestTrip: ApiTrip = trips[0];
        let minDiff = Infinity;

        const delayMinutes = delaySecs !== null ? delaySecs / 60 : 0;

        for (const trip of trips) {
            if (trip.start_mins === undefined || trip.end_mins === undefined) continue;

            const startMins = trip.start_mins;
            
            const startMinsWithBuffer = startMins - BUFFER_MINS;
            let endMinsWithBuffer = trip.end_mins + delayMinutes + BUFFER_MINS;
            
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
        const tripStartMins = finalTrip.start_mins;
        const checkMinsForStart = currentMinutes < tripStartMins - BUFFER_MINS ? currentMinutes + 24 * 60 : currentMinutes;
        
        let statePosition = defaultState;
        if (checkMinsForStart < tripStartMins) {
            statePosition = (delaySecs !== null && delaySecs > 60) ? 'before_track_delayed' : 'before_track';
        }

        return { tripId: finalTrip.trip_id, statePosition };
    }

    async fetchRawArcgisFeed(): Promise<ArcgisResponse> {
        return CacheManager.getOrFetch(
            `vehicles_live_raw_${this.city.slug}`,
            10000,
            async () => {
                const arcgisConfigUrl = this.city.adapterConfig?.realtimeArcgisUrl;
                if (!arcgisConfigUrl) {
                    throw new Error(`Missing KORDIS ArcGIS configuration.`);
                }

                let finalArcgisUrl = arcgisConfigUrl;
                try {
                    // OPTIMIZATION: Prevent ArcGIS from doing a full table scan by limiting to the last 15 mins
                    const urlObj = new URL(arcgisConfigUrl);
                    if (urlObj.searchParams.has('where')) {
                        const pastMs = Date.now() - (15 * 60 * 1000);
                        urlObj.searchParams.set('where', `IsInactive='false' AND TimeUpdated > ${pastMs}`);
                        finalArcgisUrl = urlObj.toString();
                    }
                } catch {
                    // Silently fallback to original url if parsing fails
                }

                try {
                    // ApiClient automatically brings the 8.5s timeout and standard headers
                    const resArcgis = await appClient.fetch(finalArcgisUrl, { 
                        cf: { cacheTtl: 10 }
                    });
                    
                    const data = await resArcgis.json() as ArcgisResponse;
                    return { ...data, status: 'ok' };
                } catch (e) {
                    console.error("KORDIS ArcGIS fetch timed out or failed:", e);
                    return { features: [], status: 'upstream_offline' };
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
        delay: number | null,
        statePosition: string
    ): AppVehicleFeature {
        const routeColor = route?.route_color ? (route.route_color.startsWith('#') ? route.route_color : `#${route.route_color}`) : '#4b5563';
        const rType = route ? Number(route.type) : ([0, 1, 11, 3, 4, 2][attr.VType] ?? 3);
        
        const lineName = attr.LineName || '?';
        const finalLineName = route?.short_name || route?.name || lineName;

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
                trip_headsign: '',
                bearing: attr.Bearing || null,
                delay: delay,
                state_position: statePosition,
                run_number: attr.Course || undefined,
                last_stop_sequence: attr.LastStopID && attr.LastStopID > 0 ? attr.LastStopID : null,
                is_night: false,
                vehicle_descriptor: {
                    operator: 'IDS JMK',
                    vehicle_registration_number: attr.ID.toString()
                },
                origin_timestamp: new Date(attr.TimeUpdated).toISOString(),
                is_static_fallback: false,
                route_color: routeColor
            }
        };
    }


    private getCurrentTimeContext() {
        const parts = PRAGUE_TZ_FORMATTER.formatToParts(new Date());
        const y = parts.find(p => p.type === 'year')?.value || '';
        const m = parts.find(p => p.type === 'month')?.value || '';
        const d = parts.find(p => p.type === 'day')?.value || '';
        const hh = parts.find(p => p.type === 'hour')?.value || '0';
        const mm = parts.find(p => p.type === 'minute')?.value || '0';
        const ss = parts.find(p => p.type === 'second')?.value || '0';

        const todayLocalStr = `${y}${m}${d}`;
        const currentMinutes = (Number(hh) % 24) * 60 + Number(mm) + Number(ss) / 60;
        
        return { todayLocalStr, currentMinutes };
    }

    private async getCoreData() {
        const staticUrl = this.city.adapterConfig?.staticDataUrl;
        if (!staticUrl) {
            throw new Error(`Missing KORDIS Static URL configuration.`);
        }
        const apiUrl = `${staticUrl}/${this.city.slug}/api.json`;
        return Promise.all([
            CacheManager.getOrFetch<ApiMapping | null>(
                `api_mapping_${this.city.slug}`, 
                CACHE_TTL.TWO_HOURS_MS, 
                async () => {
                    const resApi = await appClient.fetch(apiUrl, { cf: { cacheTtl: 7200 } });
                    return await resApi.json() as ApiMapping;
                }
            ),
            this.fetchRawArcgisFeed(),
            getGtfsData(this.city.slug)
        ]);
    }

    async getSingleLiveVehicle(vehicleId: string, gtfsTripId?: string): Promise<{ liveMatch?: AppVehicleFeature, lastStopId?: string }> {
        const [apiMapping, arcgisData, gtfsData] = await this.getCoreData();
        if (!apiMapping || !arcgisData?.features || arcgisData.features.length === 0) {
            return {};
        }

        const targetId = Number(vehicleId);
        
        let rawMatch = arcgisData.features.find(f => targetId && f.attributes.ID === targetId);
        
        const { todayLocalStr, currentMinutes } = this.getCurrentTimeContext();
        let finalTripId: string | null = null;
        let finalStatePos: string = 'in_transit_to';
        let finalDelay: number | null = null;

        if (!rawMatch && gtfsTripId) {
            // Expensive fallback: iterate raw data to find matching tripId
            for (const feature of arcgisData.features) {
                const attr = feature.attributes;
                if (attr.IsInactive === 'true') continue;
                
                const delay = typeof attr.Delay === 'number' && attr.Delay !== 0 ? attr.Delay * 60 : null;
                const tripsForCourse = apiMapping[`${attr.LineID}-${attr.RouteID}`];
                const { tripId, statePosition } = this.resolveActiveTrip(tripsForCourse, currentMinutes, todayLocalStr, delay, !!attr.LastStopID);
                
                if (tripId === gtfsTripId) {
                    rawMatch = feature;
                    finalTripId = tripId;
                    finalStatePos = statePosition;
                    finalDelay = delay;
                    break;
                }
            }
        }

        if (!rawMatch) return {};

        const attr = rawMatch.attributes;
        if (!finalTripId) {
            finalDelay = typeof attr.Delay === 'number' && attr.Delay !== 0 ? attr.Delay * 60 : null;
            const tripsForCourse = apiMapping[`${attr.LineID}-${attr.RouteID}`];
            const resolved = this.resolveActiveTrip(tripsForCourse, currentMinutes, todayLocalStr, finalDelay, !!attr.LastStopID);
            finalTripId = resolved.tripId;
            finalStatePos = resolved.statePosition;
        }
        const route = this.resolveRoute(attr, finalTripId, gtfsData);
        const liveMatch = this.mapVehicle(attr, finalTripId, route, finalDelay, finalStatePos);

        return { 
            liveMatch, 
            lastStopId: attr.LastStopID?.toString() 
        };
    }

    async getCachedMappedVehicles(): Promise<AppVehicleCollection> {
        return CacheManager.getOrFetch<AppVehicleCollection>(
            `kordis_vehicles_${this.city.slug}`, 
            CACHE_TTL.TEN_SECONDS_MS, 
            async () => {
                const [apiMapping, arcgisData, gtfsData] = await this.getCoreData();

                if (!apiMapping) {
                    return { type: 'FeatureCollection', features: [], status: 'upstream_offline' };
                }

                if (!arcgisData?.features || arcgisData.features.length === 0) {
                    const status = arcgisData?.status || 'upstream_offline';
                    return { type: 'FeatureCollection', features: [], status };
                }

                const { todayLocalStr, currentMinutes } = this.getCurrentTimeContext();

                const features: AppVehicleFeature[] = [];
                // Filter out vehicles that haven't updated in 10+ minutes
                const THRESHOLD_MS = 10 * 60 * 1000;
                const nowMs = Date.now();
                const seenVehicles = new Set<string>();
                let maxTimeUpdated = 0;

                for (const feature of arcgisData.features) {
                    const attr = feature.attributes;
                    if (attr.TimeUpdated > maxTimeUpdated) {
                        maxTimeUpdated = attr.TimeUpdated;
                    }
                    
                    if (nowMs - attr.TimeUpdated > THRESHOLD_MS) continue;
                    if (attr.IsInactive === 'true') continue;

                    const vehicleIdStr = attr.ID.toString();
                    if (seenVehicles.has(vehicleIdStr)) continue;
                    seenVehicles.add(vehicleIdStr);

                    const delay = typeof attr.Delay === 'number' && attr.Delay !== 0 ? attr.Delay * 60 : null; // Convert minutes to seconds
                    
                    const tripsForCourse = apiMapping[`${attr.LineID}-${attr.RouteID}`];
                    const { tripId, statePosition } = this.resolveActiveTrip(tripsForCourse, currentMinutes, todayLocalStr, delay, !!attr.LastStopID);
 
                    const route = this.resolveRoute(attr, tripId, gtfsData);
                    const liveMatch = this.mapVehicle(attr, tripId, route, delay, statePosition);
                    features.push(liveMatch);
                }

                const isStale = maxTimeUpdated > 0 && (nowMs - maxTimeUpdated > THRESHOLD_MS);
                const status = isStale ? 'stale' : (arcgisData.status || 'ok');

                const result: AppVehicleCollection = { 
                    type: 'FeatureCollection', 
                    features,
                    status,
                    last_updated: maxTimeUpdated > 0 ? new Date(maxTimeUpdated).toISOString() : undefined
                };

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
    }

    async getFilteredVehicles(ctx: EventContext<Env, string, unknown>): Promise<AppVehicleCollection> {
        const allVehicles = await this.getCachedMappedVehicles();

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

        return { 
            type: 'FeatureCollection', 
            features: filteredFeatures,
            status: allVehicles.status,
            last_updated: allVehicles.last_updated
        };
    }
}
