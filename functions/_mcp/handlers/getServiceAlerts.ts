import type { AppAlert, AppAlertsResponse } from "../../_core/types";
import type { CityUseCases } from "../../_domain/use-cases";
import type { GtfsRoute } from "../../_feeds/gtfs/gtfs-data";
import type { McpContext } from "../types";
import { MCP_DEFAULTS } from "../../_core/config";
import { getCityConfig } from "../../_cities";
import { getGtfsRoutes } from "../../_feeds/gtfs/gtfs-data";
import { buildRequestContext, getMcpTimeContext, loadInfotexts } from "../utils";

/**
 * Alert line names by whatever id the feed used - the main `/api/[city]/alerts` response leaves
 * `line_metadata` unresolved (the app's own frontend joins it against the same routes.json), but
 * this tool has no frontend to hand that off to, so it resolves its own small id->name map here.
 * Also tries KORDIS's numeric alert ids ("120") against routes.json's real keys ("L120D99"), the
 * same fallback the backend used to do before that moved to the frontend.
 */
async function resolveLineNames(resolvedCity: string): Promise<(entry: NonNullable<AppAlert['line_metadata']>[number]) => string> {
    const cityConfig = getCityConfig(resolvedCity);
    if (!cityConfig) return (entry) => entry.name ?? entry.route_id ?? '';

    const { routes } = await getGtfsRoutes(cityConfig).catch(() => ({ routes: {} as Record<string, GtfsRoute> }));

    // Built lazily, once, on first miss - most alerts resolve directly via `routes[id]`.
    let byName: Map<string, GtfsRoute> | undefined;
    let byKordisNumeric: Map<string, GtfsRoute> | undefined;
    const buildFallbacks = (): void => {
        byName = new Map();
        byKordisNumeric = new Map();
        for (const key in routes) {
            const route = routes[key];
            if (route.name) byName.set(route.name.toUpperCase(), route);
            const match = /^L([A-Z0-9]+)D/i.exec(key);
            if (match) byKordisNumeric.set(match[1].toUpperCase(), route);
        }
    };

    return (entry) => {
        if (entry.name) return entry.name;
        if (!entry.route_id) return '';
        if (!byName) buildFallbacks();
        const upper = entry.route_id.toUpperCase();
        const route = routes[entry.route_id] ?? byName!.get(upper) ?? byKordisNumeric!.get(upper);
        return route?.short_name || route?.name || entry.route_id;
    };
}

/**
 * Handles the 'get_service_alerts' MCP tool invocation.
 * Retrieves active transit disruptions, closures, detours, and news alerts.
 * 
 * @param args - Tool arguments containing optional `line` filter and `city`.
 * @param ctx - Cloudflare Pages Function event context.
 * @param city - The target city's use-cases.
 * @param resolvedCity - Normalized city slug (a `CITY_REGISTRY` key).
 * @returns Active service alerts and stop infotext notices.
 */
export async function handleGetServiceAlerts(
    args: Record<string, unknown>,
    ctx: McpContext,
    city: CityUseCases,
    resolvedCity: string
): Promise<unknown> {
    const alertsCtx = buildRequestContext(ctx);

    const [alertsData, infotextsData, lineNameOf] = await Promise.all([
        city.alerts.getAlerts(alertsCtx).catch((): AppAlertsResponse => ({ alerts: [] })),
        loadInfotexts(ctx, city, resolvedCity),
        resolveLineNames(resolvedCity)
    ]);

    const linesOf = (a: AppAlert): string[] => (a.line_metadata ?? []).map(lineNameOf).filter(Boolean);

    let alerts = (alertsData?.alerts || []);
    if (args.line) {
        const lineQuery = String(args.line).trim().toLowerCase();
        alerts = alerts.filter((a) => linesOf(a).some((l) => l.toLowerCase() === lineQuery));
    }

    return {
        city: resolvedCity,
        ...getMcpTimeContext(resolvedCity, Date.now()),
        alerts_count: alerts.length,
        alerts: alerts.slice(0, Number(args.limit) || MCP_DEFAULTS.ALERTS_LIMIT).map((a) => ({
            title: a.title,
            description: a.description,
            affected_lines: linesOf(a),
            valid_from: a.valid_from,
            valid_to: a.valid_to,
            link: a.link
        })),
        infotexts: infotextsData
    };
}
