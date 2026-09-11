import type { EventContext } from "@cloudflare/workers-types";
import type { Env, AppAlertsResponse, AppVehicleCollection, AppDepartureResponse, AppVehicleDetail, AppCityStats } from "../../_core/types";
import { GtfsAdapter } from '../gtfs/GtfsAdapter';
import type { VehiclesService } from '../gtfs/services/vehicles/VehiclesService';
import { DpmpVehiclesService } from './services/vehicles/DpmpVehiclesService';
import { getDpmpCsvFeed } from './core/dpmp-csv-feed';
import { DPMP_CONFIG } from './core/config';

/** The dev relay URL when the request is served locally, otherwise undefined (use the upstream). */
function devRelayUrl(ctx: EventContext<Env, string, unknown>): string | undefined {
    const url = new URL(ctx.request.url);
    return DPMP_CONFIG.DEV_HOSTNAMES.includes(url.hostname)
        ? new URL(DPMP_CONFIG.DEV_RELAY_PATH, url.origin).toString()
        : undefined;
}

/**
 * Prešov (DPMP): static GTFS served like Brno, with realtime positions from DPMP's CSV export
 * instead of a GTFS-RT feed. The export carries no service alerts.
 */
export class DpmpAdapter extends GtfsAdapter {
    protected override createVehiclesService(): VehiclesService {
        return new DpmpVehiclesService(this.city);
    }

    /** Applies request-scoped settings; adapters are built per request, so this cannot leak. */
    private bindRequest(ctx: EventContext<Env, string, unknown>): void {
        if (this.vehiclesService instanceof DpmpVehiclesService) {
            this.vehiclesService.setRealtimeUrlOverride(devRelayUrl(ctx));
        }
    }

    override async handleVehicles(ctx: EventContext<Env, string, unknown>): Promise<AppVehicleCollection> {
        this.bindRequest(ctx);
        return super.handleVehicles(ctx);
    }

    override async handleDepartures(ctx: EventContext<Env, string, unknown>): Promise<AppDepartureResponse> {
        this.bindRequest(ctx);
        return super.handleDepartures(ctx);
    }

    override async handleVehicleDetail(ctx: EventContext<Env, string, unknown>): Promise<AppVehicleDetail> {
        this.bindRequest(ctx);
        return super.handleVehicleDetail(ctx);
    }

    override async handleStats(ctx: EventContext<Env, string, unknown>): Promise<AppCityStats> {
        this.bindRequest(ctx);
        return super.handleStats(ctx);
    }

    override async handleAlerts(_ctx: EventContext<Env, string, unknown>): Promise<AppAlertsResponse> {
        return { alerts: [] };
    }

    override async handleRawFeed(ctx: EventContext<Env, string, unknown>, type: string = 'vehicles'): Promise<unknown> {
        if (type === 'alerts') return [];
        return getDpmpCsvFeed(this.city, devRelayUrl(ctx));
    }
}
