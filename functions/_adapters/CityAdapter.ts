import type { EventContext } from "@cloudflare/workers-types";
import type { Env, AppStopCollection, AppVehicleCollection, AppDepartureResponse, AppVehicleDetail, AppAlertsResponse, AppInfotext } from "../_core/types";
import type { CityConfig } from '../_core/city-config';
import { GolemioAdapter } from './golemio/GolemioAdapter';

/** Contract all city adapters must fulfill. */
export interface CityAdapter {
    /** Handle /api/[city]/stops */
    handleStops(ctx: EventContext<Env, string, unknown>): Promise<AppStopCollection>;
    /** Handle /api/[city]/vehicles */
    handleVehicles(ctx: EventContext<Env, string, unknown>): Promise<AppVehicleCollection>;
    /** Handle /api/[city]/departures */
    handleDepartures(ctx: EventContext<Env, string, unknown>): Promise<AppDepartureResponse>;
    /** Handle /api/[city]/vehicles/:id */
    handleVehicleDetail(ctx: EventContext<Env, string, unknown>): Promise<AppVehicleDetail>;
    /** Handle /api/[city]/alerts */
    handleAlerts(ctx: EventContext<Env, string, unknown>): Promise<AppAlertsResponse>;
    /** Handle /api/[city]/infotexts */
    handleInfotexts(ctx: EventContext<Env, string, unknown>): Promise<AppInfotext[]>;
}

/** Returns the correct adapter for a city. Exhaustive — tsc will catch missing cases. */
export function getAdapter(city: CityConfig): CityAdapter {
    switch (city.adapter) {
        case 'golemio': return new GolemioAdapter(city);
    }
}
