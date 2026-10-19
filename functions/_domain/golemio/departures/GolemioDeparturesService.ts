import type { AppDepartureResponse, CityRequestContext } from "../../../_core/types";
import type { DeparturesUseCase } from "../../useCases";
import { ERROR_MESSAGES } from "../../../_core/config";
import { ApiError } from "../../../_core/errors";
import { getDepartureBoards } from "../../../_feeds/golemio/departures";
import { mapGolemioDepartures } from "./golemioDeparturesMapper";
import { departuresQuerySchema, parseSearchParams } from "../../../_core/schemas";
import { stopIdParts } from '../../../_core/utils/stopIds';
import { getLiveConnections } from "../../../_feeds/golemio/connections";

/** Prague departure boards: Golemio's boards for the requested platforms, with PID connections. */
export class GolemioDeparturesService implements DeparturesUseCase {
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

        const data = await getDepartureBoards(ctx.env, stopIds.map(stopIdParts));

        const connections = await getLiveConnections(data.flatMap(group => group.map(item => item.trip?.id)));
        return mapGolemioDepartures(data, stopIds, connections);
    }
}
