import type { McpContext } from "../types";
import { MCP_DEFAULTS } from "../../_core/config";
import { resolveAdapter } from "../utils";
import { validateToolArgs } from "../validation";

import { handleSearchStops } from "./searchStops";
import { handleSearchNearestStops } from "./searchNearestStops";
import { handleGetNextDepartures } from "./getNextDepartures";
import { handleGetNearestDepartures } from "./getNearestDepartures";
import { handleGetRealtimeVehicles } from "./getRealtimeVehicles";
import { handleGetServiceAlerts } from "./getServiceAlerts";
import { handleGetVehicleDetail } from "./getVehicleDetail";

/**
 * Dispatcher for MCP tool calls.
 */
export async function handleToolCall(
    name: string,
    rawArgs: Record<string, unknown>,
    ctx: McpContext
): Promise<unknown> {
    // Validated up front, so every handler below can rely on the declared inputSchema's types and ranges.
    const args = validateToolArgs(name, rawArgs);

    const citySlug = (args.city as string | undefined) ?? MCP_DEFAULTS.CITY;
    const { adapter, citySlug: resolvedCity } = resolveAdapter(citySlug);

    switch (name) {
        case "search_stops":
            return handleSearchStops(args, ctx, adapter, resolvedCity);
        case "search_nearest_stops":
            return handleSearchNearestStops(args, ctx, adapter, resolvedCity);
        case "get_next_departures":
            return handleGetNextDepartures(args, ctx, adapter, resolvedCity);
        case "get_nearest_departures":
            return handleGetNearestDepartures(args, ctx, adapter, resolvedCity);
        case "get_realtime_vehicles":
            return handleGetRealtimeVehicles(args, ctx, adapter, resolvedCity);
        case "get_service_alerts":
            return handleGetServiceAlerts(args, ctx, adapter, resolvedCity);
        case "get_vehicle_detail":
            return handleGetVehicleDetail(args, ctx, adapter, resolvedCity);
        default:
            throw new Error(`Unknown MCP tool '${name}'`);
    }
}
