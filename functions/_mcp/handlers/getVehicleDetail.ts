import type { CityUseCases } from "../../_domain/use-cases";
import type { McpContext } from "../types";
import { buildRequestContext, getMcpTimeContext } from "../utils";

/**
 * Handles the 'get_vehicle_detail' MCP tool invocation.
 * Retrieves detailed itinerary, stop schedule progress, and delay details for a vehicle/trip.
 * 
 * @param args - Tool arguments containing required `trip_id` and optional `vehicle_id` and `city`.
 * @param ctx - Cloudflare Pages Function event context.
 * @param city - The target city's use-cases.
 * @param resolvedCity - Normalized city slug (a `CITY_REGISTRY` key).
 * @returns Detailed vehicle itinerary and stop sequence schedule.
 */
export async function handleGetVehicleDetail(
    args: Record<string, unknown>,
    ctx: McpContext,
    city: CityUseCases,
    resolvedCity: string
): Promise<unknown> {
    const tripId = (args.trip_id as string) || (args.gtfs_trip_id as string);
    if (!tripId) {
        return { error: "Parameter 'trip_id' is required for vehicle detail." };
    }

    const searchParams: Record<string, string> = { tripId };
    if (args.vehicle_id) searchParams.vehicleId = String(args.vehicle_id);

    const detailCtx = buildRequestContext(ctx, searchParams);
    // The route line is map geometry: thousands of coordinates an MCP client has no use for.
    const { route_geojson: _routeGeojson, ...detailData } = await city.detail.getVehicleDetail(detailCtx);

    return {
        city: resolvedCity,
        ...getMcpTimeContext(resolvedCity, Date.now()),
        trip_id: tripId,
        detail: detailData
    };
}
