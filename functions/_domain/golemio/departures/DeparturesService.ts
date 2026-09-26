import type { AppDepartureResponse, CityRequestContext } from "../../../_core/types";
import type { DeparturesUseCase } from "../../use-cases";
import { ERROR_MESSAGES } from "../../../_core/config";
import { ApiError } from "../../../_core/errors";
import { getDepartureBoards } from "../../../_feeds/golemio/departures";
import { DeparturesMapper } from "./DeparturesMapper";
import { departuresQuerySchema, parseSearchParams } from "../../../_core/schemas";
import { getLiveConnections } from "../../../_feeds/golemio/connections";

/** Prague departure boards: Golemio's boards for the requested platforms, with PID connections. */
export class DeparturesService implements DeparturesUseCase {
    /**
     * Filters a comma-separated string of stop IDs down to the specific platform nodes (Z-nodes)
     * suitable for querying the departure board API.
     * 
     * PID Domain Logic:
     * - "S" nodes represent Station areas (Parent stations). These are structural and cannot be queried for departures.
     * - "Z" nodes represent specific Platforms (Zastávky). Departures are always attached to platforms.
     * 
     * If a query includes a mix of S and Z nodes, we strip the S nodes to prevent upstream API errors.
     * If no Z nodes exist, we fall back to raw IDs to ensure the query doesn't fail silently.
     * Also strips internal "centroid-" prefixes.
     * 
     * @param stopId The raw stop ID (potentially a comma-separated list of child IDs)
     * @returns Array of filtered platform IDs ready for Golemio API
     */
    private filterStopIdsForDepartures(stopId: string): string[] {
        const cleanStopId = stopId.replace(/^centroid-/, '');
        const rawIds = cleanStopId.split(',');
        const finalIds = rawIds.filter(id => {
            if (id.includes('S')) return false; 
            if (!id.includes('Z')) return false; 
            return true;
        });
        return finalIds.length > 0 ? finalIds : rawIds;
    }

    /**
     * Fetches departures for a given stop, processes and normalizes the data,
     * including deduplicating metro trains and formatting line metadata.
     * 
     * @returns {Promise<AppDepartureResponse>} Normalized departures response
     * @throws {ApiError} If stopId is missing or upstream fetch fails
     */
    async getDepartures(ctx: CityRequestContext): Promise<AppDepartureResponse> {
        const { stopId: rawStopIds } = parseSearchParams(ctx.url.searchParams, departuresQuerySchema);
        const stopIds = rawStopIds.filter((id): id is string => !!id);

        if (stopIds.length === 0) {
            throw new ApiError(ERROR_MESSAGES.MISSING_PARAMS, 400);
        }

        const data = await getDepartureBoards(ctx.env, stopIds.map(id => this.filterStopIdsForDepartures(id)));

        const connections = await getLiveConnections(data.flatMap(group => group.map(item => item.trip?.id)));
        return DeparturesMapper.map(data, stopIds, connections);
    }
}
