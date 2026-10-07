import type { CityConfig } from '../../_core/cityConfig';
import { noInfotexts, type AlertsUseCase, type CityUseCases, type DebugFeed, type DeparturesUseCase, type VehicleDetailUseCase } from '../useCases';
import { DeparturesService } from './departures/DeparturesService';
import { VehicleDetailService } from './vehicles/VehicleDetailService';
import { AlertsService } from './alerts/AlertsService';
import { GtfsRtVehicleDetailEnricher } from './vehicles/GtfsRtVehicleDetailEnricher';
import { VehiclesService } from '../vehicles/VehiclesService';
import type { NetworkVehicles } from '../vehicles/vehicleSource';
import { GtfsRtVehicleSource } from './vehicles/GtfsRtVehicleSource';
import { EdgeFleetSource } from '../vehicles/EdgeFleetSource';
import { createGtfsAlertsMapper, type AlertsMapper } from './alerts/alertsMapper';
import { decodeAlertEntity } from '../../_core/gtfsRtDecode';
import { getGtfsRtFeed } from '../../_feeds/gtfs/gtfsRtFeed';

/**
 * What a city built on the GTFS stack does differently. Everything omitted is the GTFS default: a
 * GTFS-RT feed for vehicles, timetable departures and detail, and alerts from the same feed.
 */
export interface GtfsOverrides {
    /** Where vehicles come from; the default reads the city's GTFS-RT feed. */
    vehicleSource?: NetworkVehicles;
    alertsMapper?: AlertsMapper;
    departures?: (vehicles: VehiclesService) => DeparturesUseCase;
    /** Wraps the timetable detail, for vehicles the timetable does not cover. */
    detail?: (timetable: VehicleDetailUseCase, vehicles: VehiclesService) => VehicleDetailUseCase;
    alerts?: AlertsUseCase;
    debugFeed?: DebugFeed;
}

/** The use-cases of a city on the GTFS stack. */
export function gtfsUseCases(config: CityConfig, overrides: GtfsOverrides = {}): CityUseCases {
    const vehicles = new VehiclesService(config, new EdgeFleetSource(config.slug, overrides.vehicleSource ?? new GtfsRtVehicleSource(config)));
    const timetableDetail = new VehicleDetailService(config, new GtfsRtVehicleDetailEnricher(vehicles));

    return {
        vehicles,
        departures: overrides.departures?.(vehicles) ?? new DeparturesService(config, vehicles),
        detail: overrides.detail?.(timetableDetail, vehicles) ?? timetableDetail,
        alerts: overrides.alerts ?? new AlertsService(config, overrides.alertsMapper ?? createGtfsAlertsMapper()),
        infotexts: noInfotexts,
        debugFeed: overrides.debugFeed ?? {
            async getRawFeed(_ctx, type) {
                const feed = await getGtfsRtFeed(config);
                return type === 'alerts' ? feed.alertEntities.map(decodeAlertEntity) : feed.entity;
            },
        },
    };
}
