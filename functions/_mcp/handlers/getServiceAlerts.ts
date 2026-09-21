import type { AppAlertsResponse } from "../../_core/types";
import type { CityUseCases } from "../../_domain/use-cases";
import type { McpContext } from "../types";
import { MCP_DEFAULTS } from "../../_core/config";
import { buildRequestContext, getMcpTimeContext, loadInfotexts } from "../utils";

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

    const [alertsData, infotextsData] = await Promise.all([
        city.alerts.getAlerts(alertsCtx).catch((): AppAlertsResponse => ({ alerts: [] })),
        loadInfotexts(ctx, city, resolvedCity)
    ]);

    let alerts = (alertsData?.alerts || []);
    if (args.line) {
        const lineQuery = String(args.line).trim().toLowerCase();
        alerts = alerts.filter((a) => {
            const lines = a.lines || [];
            return lines.some((l: string) => String(l).toLowerCase() === lineQuery);
        });
    }

    return {
        city: resolvedCity,
        ...getMcpTimeContext(resolvedCity, Date.now()),
        alerts_count: alerts.length,
        alerts: alerts.slice(0, Number(args.limit) || MCP_DEFAULTS.ALERTS_LIMIT).map((a) => ({
            title: a.title,
            description: a.description,
            affected_lines: a.lines || [],
            valid_from: a.valid_from,
            valid_to: a.valid_to,
            link: a.link
        })),
        infotexts: infotextsData
    };
}
