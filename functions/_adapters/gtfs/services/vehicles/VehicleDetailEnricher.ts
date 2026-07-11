import type { EventContext } from "@cloudflare/workers-types";
import type { Env, AppVehicleDetail } from "../../../../_core/types";

export interface VehicleDetailEnricher {
    enrich(detail: AppVehicleDetail, ctx: EventContext<Env, string, unknown>): Promise<AppVehicleDetail>;
}
