import type { EventContext } from "@cloudflare/workers-types";
import type { Env, AppInfotext } from "../_core/types";
import { getCityConfig } from "../_core/city-config";
import { getAdapter, type CityAdapter } from "../_adapters/CityAdapter";

/**
 * Standard CORS headers for MCP client compatibility across tools (Claude Code, Cursor, web browsers, etc.)
 */
export const CORS_HEADERS: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-session-id",
};

/**
 * Creates a synthetic EventContext for invoking CityAdapter methods.
 * Reuses 100% of underlying API caching, normalization, and fetch wrappers.
 */
export function createMockContext(
    ctx: EventContext<Env, string, unknown>,
    citySlug: string,
    urlPath: string,
    searchParams?: Record<string, string> | URLSearchParams
): EventContext<Env, string, unknown> {
    const url = new URL(`https://departs.app${urlPath}`);
    if (searchParams) {
        if (searchParams instanceof URLSearchParams) {
            searchParams.forEach((v, k) => url.searchParams.append(k, v));
        } else {
            Object.entries(searchParams).forEach(([k, v]) => {
                if (v !== undefined) url.searchParams.set(k, v);
            });
        }
    }

    const request = new Request(url.toString(), {
        headers: {
            'User-Agent': 'departs-mcp-server/1.0',
            'Accept': 'application/json'
        }
    });

    return {
        request,
        env: ctx.env,
        params: { city: citySlug },
        functionPath: urlPath,
        data: {},
        next: async () => new Response("Not found", { status: 404 }),
        waitUntil: (promise: Promise<unknown>) => ctx.waitUntil(promise)
    } as unknown as EventContext<Env, string, unknown>;
}

/**
 * Helper to get CityAdapter for a given city slug.
 */
export function resolveAdapter(citySlug?: string): { adapter: CityAdapter; citySlug: string } {
    const slug = (citySlug || "prague").toLowerCase();
    const cityConfig = getCityConfig(slug);
    if (!cityConfig) {
        throw new Error(`Unsupported city '${citySlug}'. Supported cities: prague, brno.`);
    }
    return { adapter: getAdapter(cityConfig), citySlug: slug };
}

/**
 * Haversine distance in meters between two lat/lon coordinates.
 */
export function calculateHaversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Route type matching helper for transit types (bus, tram, metro, train, trolleybus).
 */
export function matchesRouteType(departureType: string | number, routeTypeQuery: string): boolean {
    const query = String(routeTypeQuery).trim().toLowerCase();
    const typeStr = String(departureType).trim().toLowerCase();

    if (query === typeStr) return true;

    if (query === 'rail' || query === 'train') return typeStr === 'train';
    if (query === 'subway' || query === 'metro') return typeStr === 'metro';

    return false;
}

/**
 * Retrieves cached stop notice banners (infotexts) for a given stopId (0 extra cost).
 */
export async function getMatchingInfotexts(
    ctx: EventContext<Env, string, unknown>,
    adapter: CityAdapter,
    resolvedCity: string,
    targetStopId: string
): Promise<AppInfotext[]> {
    try {
        const infoCtx = createMockContext(ctx, resolvedCity, `/api/${resolvedCity}/infotexts`);
        const allInfotexts = await adapter.handleInfotexts(infoCtx) as AppInfotext[];
        if (!Array.isArray(allInfotexts)) return [];

        const stopIdLower = targetStopId.toLowerCase();
        return allInfotexts.filter((info) => {
            if (!info.relatedStopIds || info.relatedStopIds.length === 0) return false;
            return info.relatedStopIds.some((sId) => String(sId).toLowerCase() === stopIdLower || stopIdLower.includes(String(sId).toLowerCase()));
        });
    } catch {
        return [];
    }
}
