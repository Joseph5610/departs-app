/* eslint-disable @typescript-eslint/no-explicit-any */

import type { CityConfig } from '../../_core/city-config';
import type { CityAdapter } from '../CityAdapter';
import { isNightRoute } from '../golemio/services/vehicles/colors';
import { NotImplementedError } from '../../_core/errors';
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { EventContext } from "@cloudflare/workers-types";
import type { Env, AppStopCollection, AppVehicleCollection, AppDepartureResponse, AppDeparture, AppVehicleDetail, AppAlertsResponse, AppInfotext } from "../../_core/types";

// PRELOAD DATA GLOBALLY FOR CLOUDFLARE WORKERS CPU OPTIMIZATION
import brnoRoutes from "../../_data/cities/brno/routes.json";
import brnoTripRoutes from "../../_data/cities/brno/trip_routes.json";
function getVehicleType(routeType: number): string {
    switch (routeType) {
        case 0: return 'Tramvaj';
        case 1: return 'Metro';
        case 2: return 'Vlak';
        case 3: return 'Autobus';
        case 4: return 'Loď';
        case 7: return 'Lanovka';
        case 11: return 'Trolejbus';
        default: return 'Spoj';
    }
}

export class GtfsAdapter implements CityAdapter {
    constructor(private _city: CityConfig) {}

    async handleStops(_ctx: EventContext<Env, string, unknown>): Promise<AppStopCollection> {
        if (!this._city.adapterConfig?.stopsFile) {
            throw new NotImplementedError();
        }
        
        // Use dynamic import or direct fetch if it was a URL. But we store it in _data/cities/brno/stops.json
        // Wait, Cloudflare Workers do not support dynamic imports with variable paths easily during build.
        // We will import it statically based on a switch or handle it differently.
        // Since we know the only GTFS city right now is brno, let's just do a manual switch.
        
        if (this._city.slug === 'brno') {
            const brnoStops = await import('../../_data/cities/brno/stops.json');
            return {
                type: 'FeatureCollection',
                features: brnoStops.default as AppStopCollection['features']
            };
        }
        
        throw new NotImplementedError();
    }
    async handleVehicles(ctx: EventContext<Env, string, unknown>): Promise<AppVehicleCollection> {
        try {
            const cache = caches.default;
            // Cache the final PROCESSED JSON output, not the raw protobuf.
            // This means protobuf decoding only runs once per 10s instead of on every request.
            const jsonCacheKey = new Request('https://kordis-jmk.cz/__processed_vehicles_v1', { method: 'GET' });
            const cached = await cache.match(jsonCacheKey);
            if (cached) {
                return cached.json();
            }

            const rtUrl = 'https://kordis-jmk.cz/gtfs/gtfsReal.dat';
            const response = await fetch(rtUrl, {
                headers: { 'User-Agent': 'departs-app/1.0' }
            });

            if (!response || !response.ok) {
                return { type: 'FeatureCollection', features: [] };
            }

            const buffer = await response.arrayBuffer();
            const GtfsRealtimeBindings = await import('gtfs-realtime-bindings');
            const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));

            const routes = brnoRoutes as Record<string, any>;
            const tripRoutes = brnoTripRoutes as Record<string, string>;

            const features: any[] = [];
            
            for (const entity of feed.entity) {
                if (entity.vehicle && entity.vehicle.position) {
                    const vp = entity.vehicle;
                    const tripId = vp.trip?.tripId;
                    if (!tripId) continue;
                    
                    const routeId = tripRoutes[tripId];
                    if (!routeId) continue;
                    
                    const route = routes[routeId];
                    if (!route) continue;

                    let status = 'running';
                    if (vp.currentStatus === 'STOPPED_AT') status = 'at_stop';

                    features.push({
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [vp.position.longitude, vp.position.latitude]
                        },
                        properties: {
                            id: vp.vehicle?.id || entity.id,
                            vehicle_id: vp.vehicle?.id || entity.id,
                            gtfs_trip_id: tripId,
                            line: route.name,
                            route_short_name: route.name,
                            route_type: Number(route.type),
                            trip_headsign: 'IDS JMK',
                            bearing: vp.position.bearing || null,
                            delay: 0,
                            state_position: status,
                            is_tracking: true,
                            route_color: route.route_color || '#888888',
                            is_night: isNightRoute(route.name),
                            origin_timestamp: vp.timestamp ? new Date(Number(vp.timestamp) * 1000).toISOString() : undefined,
                            vehicle_descriptor: {
                                operator: 'IDS JMK',
                                vehicle_registration_number: vp.vehicle?.label || vp.vehicle?.id,
                            }
                        }
                    });
                }
            }
            
            const result: AppVehicleCollection = { type: 'FeatureCollection', features };

            // Store processed JSON in cache for 10s so subsequent requests skip protobuf decode
            const responseToCache = new Response(JSON.stringify(result), {
                headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=10' }
            });
            ctx.waitUntil(cache.put(jsonCacheKey, responseToCache));

            return result;
        } catch (e) {
            console.error('Error fetching/parsing GTFS-RT:', e);
            return { type: 'FeatureCollection', features: [] };
        }
    }
    async handleDepartures(ctx: EventContext<Env, string, unknown>): Promise<AppDepartureResponse> {
        const url = new URL(ctx.request.url);
        const stopId = url.searchParams.get('stopId');
        
        if (!stopId) {
            return { departures: [] };
        }

        try {
            const safeStopId = encodeURIComponent(stopId);
            const dataUrl = `https://data.departs.app/${this._city.slug}/departures/${safeStopId}.json`;
            
            const res = await fetch(dataUrl);
            
            if (!res.ok) {
                return { departures: [] };
            }
            
            const deps = await res.json() as Array<[string, string, string, number]>;
            
            const now = Date.now();
            
            const routesModule = await import('../../_data/cities/brno/routes.json');
            const routes = routesModule.default as Record<string, any>;
            
            const mapped: AppDeparture[] = deps
                .filter(d => {
                    const ts = d[3];
                    return ts >= now - 5 * 60 * 1000 && ts <= now + 3 * 60 * 60 * 1000;
                })
                .map(d => {
                    const [trip_id, route_id, headsign, timestamp_ms] = d;
                    const scheduledIso = new Date(timestamp_ms).toISOString();
                    const route = routes[route_id];
                    
                    return {
                        tripId: trip_id,
                        line: route ? route.name : route_id,
                        type: route ? String(route.type) : 'unknown', 
                        directionId: '0', 
                        headsign: headsign,
                        scheduled: scheduledIso,
                        timestamp: scheduledIso,
                        delay: 0,
                        isCanceled: false,
                        route_color: route ? route.route_color : undefined
                    };
                })
                .slice(0, 150);
                
            return { departures: mapped };
        } catch (e) {
            console.error('Error loading static departures:', e);
            return { departures: [] };
        }
    }
    async handleVehicleDetail(ctx: EventContext<Env, string, unknown>): Promise<AppVehicleDetail> {
        const url = new URL(ctx.request.url);
        const tripId = url.searchParams.get('tripId');
        const vehicleId = url.searchParams.get('vehicleId') || null;

        if (!tripId) {
            return {
                vehicle_id: vehicleId,
                gtfs_trip_id: '',
                route_short_name: '?',
                route_type: 3,
                trip_headsign: 'Unknown destination',
                bearing: null,
                delay: 0,
                route_color: '#888888',
                is_night: false,
                is_static_fallback: true
            } as any;
        }

        try {
            const cache = caches.default;
            let currentStopId = null;
            let currentVehicleData: any = null;

            // Look up RT data from the processed vehicles JSON cache (raw .dat is no longer cached)
            const jsonCacheKey = new Request('https://kordis-jmk.cz/__processed_vehicles_v1', { method: 'GET' });
            const cachedVehicles = await cache.match(jsonCacheKey);
            if (cachedVehicles) {
                const vehiclesGeoJson: AppVehicleCollection = await cachedVehicles.json();
                const match = vehiclesGeoJson.features.find(
                    (f: any) => f.properties.vehicle_id === vehicleId
                );
                if (match) {
                    // Reconstruct minimal currentVehicleData shape from cached properties
                    const p = match.properties;
                    currentVehicleData = {
                        timestamp: p.origin_timestamp ? BigInt(Math.floor(new Date(p.origin_timestamp).getTime() / 1000)) : null,
                        currentStatus: p.state_position === 'at_stop' ? 'STOPPED_AT' : 'IN_TRANSIT_TO',
                        vehicle: {
                            label: p.vehicle_descriptor?.vehicle_registration_number,
                            id: p.vehicle_id
                        }
                    };
                    // stopId not stored in processed cache — fallback to null
                    currentStopId = null;
                }
            } else {
                // Cache miss — fetch raw RT feed as fallback
                const rtResponse = await fetch('https://kordis-jmk.cz/gtfs/gtfsReal.dat', {
                    headers: { 'User-Agent': 'departs-app/1.0' }
                });
                if (rtResponse.ok) {
                    const buffer = await rtResponse.arrayBuffer();
                    const GtfsRealtimeBindings = await import('gtfs-realtime-bindings');
                    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
                    for (const entity of feed.entity) {
                        const vid = entity.vehicle?.vehicle?.id || entity.id;
                        if (vid === vehicleId) {
                            currentStopId = entity.vehicle?.stopId || null;
                            currentVehicleData = entity.vehicle || null;
                            break;
                        }
                    }
                }
            }

            const safeTripId = encodeURIComponent(tripId);
            const tripUrl = `https://data.departs.app/${this._city.slug}/trips/${safeTripId}.json`;
            const tripRes = await fetch(tripUrl);
            const tripData = await tripRes.json();

            let feedTotalSecs = 0;
            if (currentVehicleData?.timestamp) {
                const feedTime = new Date(Number(currentVehicleData.timestamp) * 1000);
                const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Prague', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false });
                const parts = formatter.formatToParts(feedTime);
                const fHour = Number(parts.find((p: any) => p.type === 'hour')?.value) || 0;
                const fMin = Number(parts.find((p: any) => p.type === 'minute')?.value) || 0;
                const fSec = Number(parts.find((p: any) => p.type === 'second')?.value) || 0;
                feedTotalSecs = (fHour % 24) * 3600 + fMin * 60 + fSec;
            }
            
            let lineName = '?';
            let routeColor = '#888888';
            let rType = 3;
            const tripRoutes = brnoTripRoutes as Record<string, string>;
            const routeId = tripRoutes[tripId];
            
            if (routeId) {
                const routes = brnoRoutes as Record<string, any>;
                const route = routes[routeId];
                if (route) {
                    lineName = route.name;
                    routeColor = route.route_color || '#888888';
                    rType = Number(route.type);
                }
            }

            const isNight = isNightRoute(lineName);

            let lastStopSequence = null;
            let computedDelay = 0;

            const stations = tripData.map((st: any, idx: number) => {
                return {
                    id: st.stop_id,
                    name: st.name || 'Unknown',
                    sequence: idx + 1,
                    arrival_time: st.arrival_time,
                    departure_time: st.departure_time,
                    realtime_arrival_time: st.arrival_time,
                    realtime_departure_time: st.departure_time,
                    coordinates: [st.lon || 0, st.lat || 0],
                    is_wheelchair_accessible: null,
                    zone_id: null
                };
            });

            if (currentStopId) {
                const normalizedStopId = currentStopId.replace(/Z0([1-9])$/, 'Z$1');
                const foundIndex = stations.findIndex((s: any) => s.id === normalizedStopId);
                if (foundIndex !== -1) {
                    lastStopSequence = foundIndex + 1;
                    if (currentVehicleData?.timestamp && stations[foundIndex].arrival_time) {
                        const [h, m, s] = stations[foundIndex].arrival_time.split(':').map(Number);
                        let stopTotalSecs = h * 3600 + m * 60 + (s || 0);

                        if (stopTotalSecs < 14400 && feedTotalSecs > 72000) stopTotalSecs += 86400;
                        else if (feedTotalSecs < 14400 && stopTotalSecs > 72000) stopTotalSecs -= 86400;

                        computedDelay = feedTotalSecs - stopTotalSecs;
                    }
                }
            }
            
            if (lastStopSequence === null) {
                const formatter = new Intl.DateTimeFormat('en-US', {
                    timeZone: 'Europe/Prague',
                    hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false
                });
                const parts = formatter.formatToParts(new Date());
                const prmHour = Number(parts.find((p: any) => p.type === 'hour')?.value) || 0;
                const prmMin = Number(parts.find((p: any) => p.type === 'minute')?.value) || 0;
                const prmSec = Number(parts.find((p: any) => p.type === 'second')?.value) || 0;
                const currentTotalSecs = (prmHour % 24) * 3600 + prmMin * 60 + prmSec;
                let lastPassedIndex = -1;
                for (let i = 0; i < stations.length; i++) {
                    const [h, m, s] = stations[i].arrival_time.split(':').map(Number);
                    const stopTotalSecs = h * 3600 + m * 60 + (s || 0);
                    if (stopTotalSecs < currentTotalSecs) {
                        lastPassedIndex = i;
                    }
                }
                if (lastPassedIndex !== -1) {
                    lastStopSequence = lastPassedIndex + 1;
                }
            }

            const stopFeatures = stations.map((st: any) => ({
                type: 'Feature',
                properties: {
                    stop_id: st.id,
                    stop_name: st.name,
                    stop_sequence: st.sequence,
                    arrival_time: st.arrival_time,
                    departure_time: st.departure_time,
                    metro_lines: []
                }
            }));

            const coordinates: [number, number][] = stations
                .map((st: any) => st.coordinates as [number, number]);

            let routeGeoJson = undefined;
            if (coordinates.length > 1) {
                routeGeoJson = {
                    type: 'FeatureCollection',
                    features: [{
                        type: 'Feature',
                        geometry: {
                            type: 'LineString',
                            coordinates
                        },
                        properties: { route_color: routeColor }
                    }]
                };
            }

            const headsign = stations.length > 0 ? stations[stations.length - 1].name : 'Unknown destination';
            let status = 'running';
            if (currentVehicleData?.currentStatus === 'STOPPED_AT') status = 'at_stop';

            return {
                vehicle_id: vehicleId,
                gtfs_trip_id: tripId,
                route_short_name: lineName,
                route_type: 3,
                trip_headsign: headsign,
                bearing: null,
                delay: computedDelay,
                state_position: status,
                origin_timestamp: currentVehicleData?.timestamp ? new Date(Number(currentVehicleData.timestamp) * 1000).toISOString() : undefined,
                vehicle_descriptor: {
                    operator: 'IDS JMK',
                    vehicle_registration_number: currentVehicleData?.vehicle?.label || currentVehicleData?.vehicle?.id,
                },
                route_color: routeColor,
                is_night: isNight,
                is_static_fallback: false,
                last_stop_sequence: lastStopSequence,
                route_geojson: routeGeoJson,
                stop_times: {
                    features: stopFeatures
                }
            };
        } catch (e) {
            console.error("Error fetching vehicle detail:", e);
            return {
                vehicle_id: vehicleId,
                gtfs_trip_id: tripId,
                route_short_name: '?',
                route_type: 3,
                trip_headsign: 'Error',
                bearing: null,
                delay: 0,
                route_color: '#888888',
                is_night: false,
                is_static_fallback: true
            } as any;
        }
    }
    async handleAlerts(_ctx: EventContext<Env, string, unknown>): Promise<AppAlertsResponse> {
        try {
            const cache = caches.default;
            const rtRes = await cache.match(new Request('https://kordis-jmk.cz/gtfs/gtfsReal.dat'));
            if (!rtRes) return { alerts: [] };

            const buffer = await rtRes.arrayBuffer();
            const GtfsRealtimeBindings = await import('gtfs-realtime-bindings');
            const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
            
            const rawAlerts = feed.entity.filter((e: any) => e.alert);

            let routes: Record<string, any> = {};
            try {
                const routesRes = await fetch(`https://data.departs.app/${this._city.slug}/routes.json`);
                if (routesRes.ok) {
                    routes = await routesRes.json();
                }
            } catch (e) {
                console.error("Failed to fetch routes for alerts", e);
            }

            const alerts = rawAlerts.map((entity: any) => {
                const alert = entity.alert;
                const isDetour = alert.effect === 'DETOUR';
                
                const lines: string[] = [];
                const line_metadata: Array<{ name: string; route_color: string; type: string }> = [];

                if (alert.informedEntity) {
                    for (const ie of alert.informedEntity) {
                        if (ie.routeId) {
                            lines.push(ie.routeId);
                            // Kordis routeIds are often short names like "602"
                            const matchingRoute = Object.values(routes).find((r: any) => r.name === ie.routeId) as any;
                            if (matchingRoute) {
                                line_metadata.push({
                                    name: matchingRoute.name,
                                    route_color: matchingRoute.route_color || '#888888',
                                    type: getVehicleType(Number(matchingRoute.type))
                                });
                            } else {
                                line_metadata.push({
                                    name: ie.routeId,
                                    route_color: '#888888',
                                    type: 'Spoj'
                                });
                            }
                        }
                    }
                }

                const uniqueLines = [...new Set(lines)];
                const uniqueMetadata = line_metadata.filter((meta, index, self) =>
                    index === self.findIndex((m) => m.name === meta.name)
                );

                return {
                    type: isDetour ? 'exclusion' : 'incident',
                    title: alert.headerText?.translation?.[0]?.text || 'Mimořádnost',
                    description: alert.descriptionText?.translation?.[0]?.text || null,
                    link: alert.url?.translation?.[0]?.text || 'https://www.idsjmk.cz',
                    valid_from: null,
                    valid_to: null,
                    guid: entity.id,
                    priority: 'normal',
                    lines: uniqueLines.length > 0 ? uniqueLines : undefined,
                    line_metadata: uniqueMetadata.length > 0 ? uniqueMetadata : undefined,
                    isActive: true,
                    isFuture: false
                } as any;
            });

            return { alerts };
        } catch (e) {
            console.error("Error fetching GTFS-RT alerts:", e);
            return { alerts: [] };
        }
    }
    handleInfotexts(_ctx: EventContext<Env, string, unknown>): Promise<AppInfotext[]> { return Promise.resolve([]); }
}
