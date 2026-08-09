import { AppDeparture, AppDepartureResponse } from "../../../../_core/types";
import { GolemioDepartureItem } from "./schemas";
import { getVehicleColor } from "../vehicles/colors";
import { ProcessedEnrichmentData } from "../stops/enrichment";
import { fixCommaSpacing } from "../../../../_core/api-utils";
import { normalizeRouteType } from "../../../../_core/utils/routeTypes";

/**
 * Mapper for flattening and normalizing Golemio's deeply nested departure boards.
 * Groups metro lines by direction (e.g. A-Dejvická vs A-Depo Hostivař) to adhere to UI domain rules.
 */
export class DeparturesMapper {
    
    /**
     * Maps the raw array-of-arrays response from Golemio into a unified flat list of departures.
     * 
     * @param data Raw nested departure arrays
     * @param stopIds Array of requested stop IDs for reference
     * @returns Normalized departure response
     */
    static map(data: GolemioDepartureItem[][], stopIds: string[], enrichmentData: ProcessedEnrichmentData): AppDepartureResponse {
        const departures: AppDeparture[] = [];

        if (Array.isArray(data)) {
            data.forEach((groupData, idx) => {
                if (Array.isArray(groupData)) {
                    const originalStopId = stopIds[idx];
                    groupData.forEach(item => {
                        const normalized = this.normalizeDeparture(item, enrichmentData);
                        normalized.stopId = originalStopId;
                        departures.push(normalized);
                    });
                }
            });
        }

        departures.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

        return { departures };
    }

    private static normalizeDeparture(item: GolemioDepartureItem, enrichmentData: ProcessedEnrichmentData): AppDeparture {
        const line = String(item.route?.short_name || '?').toUpperCase();
        const type = normalizeRouteType(item.route?.type || (['A', 'B', 'C'].includes(line) ? '1' : '0'));
        const isMetro = type === 'metro';
        const isTrain = type === 'train';

        let directionId: string | number | null | undefined = item.trip?.direction_id;

        if ((isMetro || isTrain) && item.stop?.id) {
            directionId = item.stop.id;
        }

        if (directionId === undefined || directionId === null) {
            directionId = item.trip?.direction_id ?? item.stop?.platform_code ?? item.trip?.headsign ?? '0';
        }

        const headsign = fixCommaSpacing(item.trip?.headsign) || 'Unknown';

        return {
            timestamp: item.departure.timestamp_predicted || item.departure.timestamp_scheduled,
            scheduled: item.departure.timestamp_scheduled,
            delay: typeof item.departure.delay_seconds === 'number' ? item.departure.delay_seconds : null,
            line,
            type,
            directionId: String(directionId),
            headsign,
            isCanceled: item.trip?.is_canceled || false,
            tripId: item.trip?.id,
            vehicleId: item.vehicle?.id ?? undefined,
            platform: item.stop?.platform_code || (isMetro && item.stop?.id ? item.stop.id.match(/Z\d+(\d)P?$/)?.[1] : undefined),
            route_color: getVehicleColor(type, line),
            is_wheelchair_accessible: item.vehicle?.is_wheelchair_accessible,
            is_air_conditioned: item.vehicle?.is_air_conditioned,
            headsign_metro_lines: (enrichmentData.headsignLookup.get(headsign.trim().toUpperCase()) || []).filter(l => l.name !== line)
        };
    }
}
