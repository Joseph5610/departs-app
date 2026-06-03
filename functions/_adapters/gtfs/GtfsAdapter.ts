import type { CityConfig } from '../../_core/city-config';
import type { CityAdapter } from '../CityAdapter';
import { NotImplementedError } from '../../_core/errors';
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { EventContext } from "@cloudflare/workers-types";
import type { Env, AppStopCollection, AppVehicleCollection, AppDepartureResponse, AppVehicleDetail, AppAlertsResponse, AppInfotext } from "../../_core/types";

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
    handleVehicles(_ctx: EventContext<Env, string, unknown>): Promise<AppVehicleCollection> {
        throw new NotImplementedError();
    }
    async handleDepartures(ctx: EventContext<Env, string, unknown>): Promise<AppDepartureResponse> {
        const url = new URL(ctx.request.url);
        const stopId = url.searchParams.get('stopId');
        
        if (!stopId) {
            return { departures: [] };
        }

        try {
            // Fetch the static schedule JSON for this stop
            const safeStopId = encodeURIComponent(stopId);
            const dataUrl = new URL(`/gtfs/${this._city.slug}/departures/${safeStopId}.json`, url.origin);
            const res = await ctx.env.ASSETS.fetch(dataUrl);
            
            if (!res.ok) {
                return { departures: [] };
            }
            
            // Expected format: Array of [trip_id, route_short_name, headsign, timestamp_ms]
            const deps = await res.json() as Array<[string, string, string, number]>;
            
            const now = Date.now();
            
            // Fetch routes for mapping
            const routesUrl = new URL(`/api/brno/routes`, url.origin); // Wait, there's no /api/brno/routes endpoint.
            // Wait, we can import routes.json!
            const routesModule = await import('../../_data/cities/brno/routes.json');
            const routes = routesModule.default as Record<string, any>;
            
            const mapped: AppDeparture[] = deps
                // Filter out departures that are > 5 minutes in the past
                .filter(d => d[3] >= now - 5 * 60 * 1000)
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
                        timestamp: scheduledIso, // fallback timestamp when no RT
                        delay: 0,
                        isCanceled: false,
                        route_color: route ? route.route_color : undefined
                    };
                })
                .slice(0, 150); // limit to a reasonable number for frontend
                
            return { departures: mapped };
        } catch (e) {
            console.error('Error loading static departures:', e);
            return { departures: [] };
        }
    }
    handleVehicleDetail(_ctx: EventContext<Env, string, unknown>): Promise<AppVehicleDetail> {
        throw new NotImplementedError();
    }
    handleAlerts(_ctx: EventContext<Env, string, unknown>): Promise<AppAlertsResponse> { return Promise.resolve({ alerts: [] }); }
    handleInfotexts(_ctx: EventContext<Env, string, unknown>): Promise<AppInfotext[]> { return Promise.resolve([]); }
}
