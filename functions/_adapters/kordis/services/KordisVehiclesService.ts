import type { EventContext } from "@cloudflare/workers-types";
import type { CityConfig } from '../../../_core/city-config';
import type { Env, AppVehicleCollection, AppVehicleFeature } from "../../../_core/types";
import type { ApiTrip, ApiMapping, ArcgisResponse, ArcgisFeature } from './types';
import { CacheManager, CACHE_TTL } from '../../../_core/utils/CacheManager';
import { getGtfsData, GtfsData, GtfsRoute } from '../../gtfs/core/gtfs-data';
import { parseSearchParams, vehicleQuerySchema } from '../../../_core/schemas';

export class KordisVehiclesService {
    constructor(private city: CityConfig) {}

    /**
     * Resolves the current trip_id from an array of trips using the current time
     * @param delay delay in SECONDS
     */
    private resolveActiveTrips(trips: ApiTrip[], currentMinutes: number, todayLocalStr: string, delay: number): string[] {
        if (!trips || trips.length === 0) return [];
        
        const timeToMinutes = (timeStr: string) => {
            const [h, m, s] = timeStr.split(':').map(Number);
            return h * 60 + m + (s / 60);
        };

        const BUFFER_MINS = 15;
        
        let closestTrip = trips[0].trip_id;
        let minDiff = Infinity;
        const exactMatches: string[] = [];

        for (const trip of trips) {
            if (!trip.start || !trip.end) continue;

            const startMins = timeToMinutes(trip.start) - BUFFER_MINS;
            // Trip resolving delay is passed in seconds, convert back to minutes for time checking
            const delayMinutes = delay / 60;
            let endMins = timeToMinutes(trip.end) + delayMinutes + BUFFER_MINS;
            
            if (endMins < startMins) endMins += 24 * 60;
            const checkMins = currentMinutes < startMins ? currentMinutes + 24 * 60 : currentMinutes;

            const runsToday = !trip.dates || trip.dates.includes(todayLocalStr);

            if (checkMins >= startMins && checkMins <= endMins && runsToday) {
                exactMatches.push(trip.trip_id); // Add all matching trips
            }

            // Calculate distance to this trip if no exact match is found
            const dist = Math.min(Math.abs(checkMins - startMins), Math.abs(checkMins - endMins));
            if (dist < minDiff && runsToday) {
                minDiff = dist;
                closestTrip = trip.trip_id;
            }
        }

        if (exactMatches.length > 0) {
            return exactMatches;
        }

        return [closestTrip]; // Fallback to closest trip
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
                const resArcgis = await fetch(arcgisConfigUrl, { cf: { cacheTtl: 10 } });
                if (!resArcgis.ok) {
                    return { features: [] };
                }
                return await resArcgis.json() as ArcgisResponse;
            }
        );
    }

    private resolveRoute(
        attr: ArcgisFeature['attributes'],
        tripId: string | null,
        gtfsData: GtfsData,
        routesByName: Record<string, GtfsRoute>
    ): GtfsRoute | null {
        const { routes, tripRoutes } = gtfsData;
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

    private mapVehicle(attr: ArcgisFeature['attributes'], tripIds: string[], route: GtfsRoute | null, delay: number): AppVehicleFeature {
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
                gtfs_trip_id: tripIds.length > 0 ? tripIds[tripIds.length - 1] : '', // Usually the last one is the newest GTFS export
                all_gtfs_trip_ids: tripIds,
                route_short_name: finalLineName,
                route_type: rType,
                trip_headsign: attr.FinalStopName || 'Unknown',
                bearing: attr.Bearing || null,
                delay: delay,
                state_position: attr.LastStopID ? 'in_transit_to' : 'stopped_at',
                run_number: attr.Course || undefined,
                vehicle_descriptor: {
                    operator: 'IDS JMK',
                    vehicle_registration_number: attr.ID.toString(),
                    is_wheelchair_accessible: attr.LF === 'true',
                    is_air_conditioned: attr.AC === 'true'
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
            CACHE_TTL.LIVE_DATA_MS, 
            async () => {
                const staticUrl = this.city.adapterConfig?.staticDataUrl;
                if (!staticUrl) {
                    throw new Error(`Missing KORDIS Static URL configuration.`);
                }
                const apiUrl = `${staticUrl}/${this.city.slug}/api.json`;
                
                const apiMapping = await CacheManager.getOrFetch<ApiMapping | null>(
                    `api_mapping_${this.city.slug}`, 
                    CACHE_TTL.TWO_HOURS_MS, 
                    async () => {
                        const resApi = await fetch(apiUrl, { cf: { cacheTtl: 7200 } });
                        if (!resApi.ok) return null;
                        return await resApi.json() as ApiMapping;
                    }
                );

                const [arcgisData, gtfsData] = await Promise.all([
                    this.getRawVehicles(),
                    getGtfsData(this.city.slug)
                ]);

                if (!arcgisData.features.length || !apiMapping) {
                    return { type: 'FeatureCollection', features: [] };
                }

                // Index routes by short_name and name to allow O(1) fallback route resolution
                const routesByName: Record<string, GtfsRoute> = {};
                if (gtfsData.routes) {
                    for (const rId in gtfsData.routes) {
                        const r = gtfsData.routes[rId];
                        if (r.short_name) {
                            routesByName[r.short_name.toUpperCase()] = r;
                        }
                        if (r.name) {
                            routesByName[r.name.toUpperCase()] = r;
                        }
                    }
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
                    const tripIds = this.resolveActiveTrips(tripsForCourse, currentMinutes, todayLocalStr, delay);

                    const route = this.resolveRoute(attr, tripIds.length > 0 ? tripIds[0] : null, gtfsData, routesByName);
                    features.push(this.mapVehicle(attr, tripIds, route, delay));
                }

                return { type: 'FeatureCollection', features };
            }
        );

        const { searchParams } = new URL(ctx.request.url);
        const { routeType: routeTypes, routeShortName: routeShortNames } = parseSearchParams(searchParams, vehicleQuerySchema);
        
        let filteredFeatures = allVehicles.features;

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
