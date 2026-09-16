import type { EventContext } from "@cloudflare/workers-types";
import type { Env, AppAlertsResponse, AppDepartureResponse, AppVehicleDetail } from '../../_core/types';
import { ApiError } from '../../_core/errors';
import { GtfsAdapter } from '../gtfs/GtfsAdapter';
import type { VehiclesService } from '../gtfs/services/vehicles/VehiclesService';
import { DukVehiclesService } from './services/vehicles/DukVehiclesService';
import { DukDeparturesService } from './services/departures/DukDeparturesService';
import { getDukTrafficFeed } from './core/duk-traffic-feed';

/**
 * Ústecký kraj (DÚK): static data built from the national JDF export and served like Brno, with
 * realtime positions from the Portabo `/cis` traffic feed, which covers both regional (DÚK) and
 * city (MHD) vehicles. The feed carries no service alerts.
 */
export class DukAdapter extends GtfsAdapter {
    protected override createVehiclesService(): VehiclesService {
        return new DukVehiclesService(this.city);
    }

    override async handleDepartures(ctx: EventContext<Env, string, unknown>): Promise<AppDepartureResponse> {
        return new DukDeparturesService(this.city, this.vehiclesService).getDepartures(ctx);
    }

    /** Falls back to the live-only detail for vehicles the timetable does not cover (e.g. trains). */
    override async handleVehicleDetail(ctx: EventContext<Env, string, unknown>): Promise<AppVehicleDetail> {
        try {
            return await super.handleVehicleDetail(ctx);
        } catch (e) {
            if (!(e instanceof ApiError) || e.status !== 404 || !(this.vehiclesService instanceof DukVehiclesService)) throw e;

            const { searchParams } = new URL(ctx.request.url);
            const detail = await this.vehiclesService.getLiveOnlyDetail(searchParams.get('vehicleId'), searchParams.get('tripId'));
            if (!detail) throw e;
            return detail;
        }
    }

    override async handleAlerts(_ctx: EventContext<Env, string, unknown>): Promise<AppAlertsResponse> {
        return { alerts: [] };
    }

    override async handleRawFeed(_ctx: EventContext<Env, string, unknown>, type: string = 'vehicles'): Promise<unknown> {
        if (type === 'alerts') return [];
        return getDukTrafficFeed(this.city);
    }
}
