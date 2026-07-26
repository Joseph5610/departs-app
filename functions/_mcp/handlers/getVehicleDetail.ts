import type { CityAdapter } from "../../_adapters/CityAdapter";
import type { McpContext } from "../types";
import { createMockContext } from "../utils";

/**
 * Handles the 'get_vehicle_detail' MCP tool invocation.
 * Retrieves detailed itinerary, stop schedule progress, and delay details for a vehicle/trip.
 * 
 * @param args - Tool arguments containing required `trip_id` and optional `vehicle_id` and `city`.
 * @param ctx - Cloudflare Pages Function event context.
 * @param adapter - Resolved CityAdapter for the target city.
 * @param resolvedCity - Normalized city slug ('prague' or 'brno').
 * @returns Detailed vehicle itinerary and stop sequence schedule.
 */
export async function handleGetVehicleDetail(
    args: Record<string, unknown>,
    ctx: McpContext,
    adapter: CityAdapter,
    resolvedCity: string
): Promise<unknown> {
    const tripId = (args.trip_id as string) || (args.gtfs_trip_id as string);
    if (!tripId) {
        return { error: "Parameter 'trip_id' is required for vehicle detail." };
    }

    const searchParams: Record<string, string> = { tripId };
    if (args.vehicle_id) searchParams.vehicleId = String(args.vehicle_id);

    const mockCtx = createMockContext(ctx, resolvedCity, `/api/${resolvedCity}/vehicle-detail`, searchParams);
    const detailData = await adapter.handleVehicleDetail(mockCtx);

    return {
        city: resolvedCity,
        trip_id: tripId,
        detail: detailData
    };
}
