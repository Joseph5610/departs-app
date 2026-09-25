import type { McpContext } from "../types";
import { MCP_CACHE_MAX_ENTRIES, MCP_CACHE_TTL_S, MCP_DEFAULTS } from "../../_core/config";
import { readEdgeCache, writeEdgeCache } from "../../_core/ApiClient";
import { LruCache } from "../../_core/feed/LruCache";
import { resolveCity } from "../utils";
import { validateToolArgs } from "../validation";

import { handleSearchStops } from "./searchStops";
import { handleSearchNearestStops } from "./searchNearestStops";
import { handleGetNextDepartures } from "./getNextDepartures";
import { handleGetNearestDepartures } from "./getNearestDepartures";
import { handleGetRealtimeVehicles } from "./getRealtimeVehicles";
import { handleGetServiceAlerts } from "./getServiceAlerts";
import { handleGetVehicleDetail } from "./getVehicleDetail";

/** Keys whose values locate a person (their position), so they never reach the logs. */
const UNLOGGED_ARGS = new Set(["latitude", "longitude"]);

/** Tool answers by `tool|city|args`, per isolate; each entry lives for its tool's `MCP_CACHE_TTL_S`. */
const resultCache = new LruCache<{ value: unknown; expiresAt: number }>({ maxEntries: MCP_CACHE_MAX_ENTRIES });

const stableArgs = (args: Record<string, unknown>): string =>
    JSON.stringify(Object.keys(args).sort().map(key => [key, args[key]]));

const loggableArgs = (args: Record<string, unknown>): string =>
    JSON.stringify(Object.fromEntries(Object.entries(args).filter(([key]) => !UNLOGGED_ARGS.has(key) && key !== "city")));

/**
 * Dispatcher for MCP tool calls. Identical calls within the tool's TTL are answered from memory first,
 * then from the edge Cache API (`readEdgeCache`/`writeEdgeCache`, the same one `ApiClient` uses for
 * upstream fetches) - the in-memory cache alone is per isolate and does not survive eviction, which is
 * what let a `/mcp` isolate cold-start into the full CPU cost of every tool on every eviction.
 */
export async function handleToolCall(
    name: string,
    rawArgs: Record<string, unknown>,
    ctx: McpContext
): Promise<unknown> {
    // Validated up front, so every handler below can rely on the declared inputSchema's types and ranges.
    const args = validateToolArgs(name, rawArgs);
    const citySlug = (args.city as string | undefined) ?? MCP_DEFAULTS.CITY;
    const cacheKey = `${name}|${citySlug}|${stableArgs(args)}`;
    const now = Date.now();

    const cached = resultCache.get(cacheKey);
    if (cached !== undefined && cached.expiresAt > now) {
        console.log(`[MCP] ${name} city=${citySlug} args=${loggableArgs(args)} cache=hit`);
        return cached.value;
    }

    const ttlS = MCP_CACHE_TTL_S[name];
    const edgeHit = ttlS ? await readEdgeCache(cacheKey) : null;
    if (edgeHit) {
        const value: unknown = await edgeHit.json();
        resultCache.set(cacheKey, { value, expiresAt: now + ttlS * 1000 });
        console.log(`[MCP] ${name} city=${citySlug} args=${loggableArgs(args)} cache=edge`);
        return value;
    }

    console.log(`[MCP] ${name} city=${citySlug} args=${loggableArgs(args)} cache=miss`);
    const value = await runTool(name, args, ctx, citySlug);
    const isError = typeof value === "object" && value !== null && "error" in value;
    if (ttlS && !isError) {
        resultCache.set(cacheKey, { value, expiresAt: now + ttlS * 1000 });
        ctx.waitUntil(writeEdgeCache(cacheKey, new Response(JSON.stringify(value)), ttlS));
    }
    return value;
}

async function runTool(
    name: string,
    args: Record<string, unknown>,
    ctx: McpContext,
    citySlug: string
): Promise<unknown> {
    const { city, citySlug: resolvedCity } = resolveCity(citySlug, ctx.env);

    switch (name) {
        case "search_stops":
            return handleSearchStops(args, resolvedCity);
        case "search_nearest_stops":
            return handleSearchNearestStops(args, resolvedCity);
        case "get_next_departures":
            return handleGetNextDepartures(args, ctx, city, resolvedCity);
        case "get_nearest_departures":
            return handleGetNearestDepartures(args, ctx, city, resolvedCity);
        case "get_realtime_vehicles":
            return handleGetRealtimeVehicles(args, ctx, city, resolvedCity);
        case "get_service_alerts":
            return handleGetServiceAlerts(args, ctx, city, resolvedCity);
        case "get_vehicle_detail":
            return handleGetVehicleDetail(args, ctx, city, resolvedCity);
        default:
            throw new Error(`Unknown MCP tool '${name}'`);
    }
}
