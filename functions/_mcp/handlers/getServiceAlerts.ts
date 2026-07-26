import type { AppAlertsResponse, AppInfotext } from "../../_core/types";
import type { CityAdapter } from "../../_adapters/CityAdapter";
import type { McpContext } from "../types";
import { createMockContext } from "../utils";

/**
 * Handles the 'get_service_alerts' MCP tool invocation.
 * Retrieves active transit disruptions, closures, detours, and news alerts.
 * 
 * @param args - Tool arguments containing optional `line` filter and `city`.
 * @param ctx - Cloudflare Pages Function event context.
 * @param adapter - Resolved CityAdapter for the target city.
 * @param resolvedCity - Normalized city slug ('prague' or 'brno').
 * @returns Active service alerts and stop infotext notices.
 */
export async function handleGetServiceAlerts(
    args: Record<string, unknown>,
    ctx: McpContext,
    adapter: CityAdapter,
    resolvedCity: string
): Promise<unknown> {
    const mockAlertsCtx = createMockContext(ctx, resolvedCity, `/api/${resolvedCity}/alerts`);
    const mockInfoCtx = createMockContext(ctx, resolvedCity, `/api/${resolvedCity}/infotexts`);

    const [alertsData, infotextsData] = await Promise.all([
        adapter.handleAlerts(mockAlertsCtx).catch(() => ({ alerts: [] })),
        adapter.handleInfotexts(mockInfoCtx).catch(() => [])
    ]) as [AppAlertsResponse, AppInfotext[]];

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
        alerts_count: alerts.length,
        alerts: alerts.map((a) => ({
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
