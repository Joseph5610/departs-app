import type { AppVehicleCollection } from "../../_core/types";
import type { CityAdapter } from "../../_adapters/CityAdapter";
import { getCityConfig } from "../../_core/city-config";
import type { McpContext } from "../types";
import { createMockContext } from "../utils";

/**
 * Handles the 'get_realtime_vehicles' MCP tool invocation.
 * Retrieves live vehicle positions, current delays, line names, and headsigns.
 * 
 * @param args - Tool arguments containing optional `line`, `min_delay`, `limit`, and `city`.
 * @param ctx - Cloudflare Pages Function event context.
 * @param adapter - Resolved CityAdapter for the target city.
 * @param resolvedCity - Normalized city slug ('prague' or 'brno').
 * @returns Real-time vehicle positions with delay status in minutes and seconds.
 */
export async function handleGetRealtimeVehicles(
    args: Record<string, unknown>,
    ctx: McpContext,
    adapter: CityAdapter,
    resolvedCity: string
): Promise<unknown> {
    const limit = Number(args.limit) || 25;
    const searchParams: Record<string, string> = {};

    if (args.line) {
        searchParams.routeShortName = String(args.line);
    } else {
        const cityConfig = getCityConfig(resolvedCity);
        if (cityConfig?.bounds) {
            searchParams.bounds = cityConfig.bounds.join(',');
        }
    }

    const mockCtx = createMockContext(ctx, resolvedCity, `/api/${resolvedCity}/vehicles`, searchParams);
    const vehiclesData = await adapter.handleVehicles(mockCtx) as AppVehicleCollection;

    let vehicles = vehiclesData?.features || [];

    if (args.min_delay !== undefined) {
        const minDelay = Number(args.min_delay);
        vehicles = vehicles.filter((v) => {
            const delaySec = v.properties?.delay ?? 0;
            return (delaySec / 60) >= minDelay;
        });
    }

    return {
        city: resolvedCity,
        total_vehicles: vehicles.length,
        vehicles: vehicles.slice(0, limit).map((v) => {
            const props = v.properties || {};
            return {
                vehicle_id: props.vehicle_id,
                gtfs_trip_id: props.gtfs_trip_id,
                line: props.route_short_name,
                headsign: props.trip_headsign,
                delay_seconds: props.delay ?? null,
                delay_minutes: props.delay != null ? Math.round((props.delay) / 60 * 10) / 10 : null,
                coordinates: v.geometry?.coordinates || null
            };
        })
    };
}
