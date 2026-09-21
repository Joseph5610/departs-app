import type { AppVehicleDetail, CityRequestContext } from "../../../_core/types";

export interface VehicleDetailEnricher {
    enrich(detail: AppVehicleDetail, ctx: CityRequestContext): Promise<AppVehicleDetail>;
}
