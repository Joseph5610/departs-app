import type { AppVehicleDetail, CityRequestContext } from '../../../_core/types';
import type { CityConfig } from '../../../_core/city-config';
import { ApiError } from '../../../_core/errors';
import type { VehiclesService } from '../../gtfs/vehicles/VehiclesService';
import type { VehicleDetailUseCase } from '../../use-cases';
import { getDukLiveOnlyDetail } from './DukVehicleSource';

/**
 * DÚK vehicle detail: the timetable's, and for vehicles the timetable does not cover (trains and
 * other lines outside the JDF export) the live-only detail, since they still have a live position.
 */
export class DukVehicleDetail implements VehicleDetailUseCase {
    constructor(
        private readonly city: CityConfig,
        private readonly timetable: VehicleDetailUseCase,
        private readonly vehicles: VehiclesService
    ) {}

    async getVehicleDetail(ctx: CityRequestContext): Promise<AppVehicleDetail> {
        try {
            return await this.timetable.getVehicleDetail(ctx);
        } catch (error) {
            if (!(error instanceof ApiError) || error.status !== 404) throw error;
            const { searchParams } = ctx.url;
            const detail = await getDukLiveOnlyDetail(this.vehicles, this.city, searchParams.get('vehicleId'), searchParams.get('tripId'));
            if (!detail) throw error;
            return detail;
        }
    }
}
