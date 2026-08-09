import { AppStopFeature, AppStopProperties, AppRouteType } from "../../../../_core/types";
import { GolemioStopFeature } from "./schemas";
import { getVehicleColor } from "../vehicles/colors";
import { ProcessedEnrichmentData } from "./enrichment";

export class StopsMapper {
    static map(allRawStops: GolemioStopFeature[], enrichmentData: ProcessedEnrichmentData): AppStopFeature[] {
        return allRawStops
            .filter(f => {
                const enrichment = enrichmentData.enrichmentMap[f.properties.stop_id];
                if (!enrichment) return true;
                return enrichment.l && enrichment.l.some(l => l.e === 0);
            })
            .map(f => {
                const enrichment = enrichmentData.enrichmentMap[f.properties.stop_id];
                const lines: NonNullable<AppStopProperties['lines']> = enrichment
                    ? enrichment.l.map(l => ({ name: l.n, type: l.t as AppRouteType, route_color: getVehicleColor(l.t, l.n) }))
                    : [];
                return {
                    type: 'Feature' as const,
                    geometry: f.geometry,
                    properties: {
                        stop_id: f.properties.stop_id,
                        stop_name: enrichment?.n || f.properties.stop_name,
                        location_type: f.properties.location_type,
                        parent_station: f.properties.parent_station ?? null,
                        platform_code: f.properties.platform_code ?? null,
                        zone_id: f.properties.zone_id ?? null,
                        lines
                    }
                };
            });
    }
}
