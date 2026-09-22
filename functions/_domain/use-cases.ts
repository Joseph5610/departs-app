import type {
    AppAlertsResponse,
    AppDepartureResponse,
    AppInfotext,
    AppVehicleCollection,
    AppVehicleDetail,
    CityRequestContext,
} from '../_core/types';

/** What every city answers; `/api/[city]/*` routes and MCP tools call these directly. */
export interface VehiclesUseCase {
    getVehicles(ctx: CityRequestContext): Promise<AppVehicleCollection>;
}

export interface DeparturesUseCase {
    getDepartures(ctx: CityRequestContext): Promise<AppDepartureResponse>;
}

export interface VehicleDetailUseCase {
    getVehicleDetail(ctx: CityRequestContext): Promise<AppVehicleDetail>;
}

export interface AlertsUseCase {
    getAlerts(ctx: CityRequestContext): Promise<AppAlertsResponse>;
}

export interface InfotextsUseCase {
    getInfotexts(ctx: CityRequestContext): Promise<AppInfotext[]>;
}

/** The upstream payload as received, for `/api/admin/[city]/debug-feed`. */
export interface DebugFeed {
    getRawFeed(ctx: CityRequestContext, type: string): Promise<unknown>;
}

export interface CityUseCases {
    vehicles: VehiclesUseCase;
    departures: DeparturesUseCase;
    detail: VehicleDetailUseCase;
    alerts: AlertsUseCase;
    infotexts: InfotextsUseCase;
    debugFeed: DebugFeed;
}

/** For networks whose feeds carry no service alerts. */
export const noAlerts: AlertsUseCase = {
    getAlerts: async () => ({ alerts: [] }),
};
