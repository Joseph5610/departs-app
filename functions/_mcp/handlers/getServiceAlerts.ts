import type { AppAlert, AppAlertsResponse } from "../../_core/types";
import type { CityUseCases } from "../../_domain/useCases";
import type { GtfsRoute } from "../../_feeds/gtfs/gtfsData";
import type { McpContext } from "../types";
import { MCP_DEFAULTS } from "../../_core/config";
import { getCityConfig } from "../../_cities";
import { getGtfsRoutes } from "../../_feeds/gtfs/gtfsData";
import { kordisNumericId, resolveLine } from "../../../shared/lines";
import { buildRequestContext, getMcpTimeContext, loadInfotexts } from "../utils";

interface LineFallbacks {
    byName: Map<string, GtfsRoute>;
    byKordisNumeric: Map<string, GtfsRoute>;
}

/** Name and KORDIS numeric-id indexes per routes table, built on the first line `routes[id]` misses. */
const fallbacksByRoutes = new WeakMap<Record<string, GtfsRoute>, LineFallbacks>();

function lineFallbacks(routes: Record<string, GtfsRoute>): LineFallbacks {
    let fallbacks = fallbacksByRoutes.get(routes);
    if (fallbacks) return fallbacks;
    fallbacks = { byName: new Map(), byKordisNumeric: new Map() };
    for (const key in routes) {
        const route = routes[key];
        if (route.name) fallbacks.byName.set(route.name.toUpperCase(), route);
        const numeric = kordisNumericId(key);
        if (numeric) fallbacks.byKordisNumeric.set(numeric, route);
    }
    fallbacksByRoutes.set(routes, fallbacks);
    return fallbacks;
}

/**
 * Alert line names as the app shows them: the alerts response leaves `lines` unresolved for the app's own
 * routes.json join, and this tool has no app to hand that to, so it resolves them the same way here.
 */
async function resolveLineNames(resolvedCity: string): Promise<(line: string) => string> {
    const cityConfig = getCityConfig(resolvedCity);
    if (!cityConfig) return (line) => line;

    const { routes } = await getGtfsRoutes(cityConfig).catch(() => ({ routes: {} as Record<string, GtfsRoute> }));
    const byId = { get: (id: string) => routes[id] };
    const byName = { get: (name: string) => lineFallbacks(routes).byName.get(name) };
    const byKordisNumeric = { get: (id: string) => lineFallbacks(routes).byKordisNumeric.get(id) };

    return (line) => {
        const route = resolveLine(line, byId, byName, byKordisNumeric);
        return route?.short_name || route?.name || line;
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

    const linesOf = (a: AppAlert): string[] => (a.lines ?? []).map(lineNameOf).filter(Boolean);

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
