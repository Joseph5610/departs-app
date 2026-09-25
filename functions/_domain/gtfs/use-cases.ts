import type { CityConfig } from '../../_core/city-config';
import type { AlertsUseCase, CityUseCases, DebugFeed, DeparturesUseCase, VehicleDetailUseCase } from '../use-cases';
import { DeparturesService } from './departures/DeparturesService';
import { VehicleDetailService } from './vehicles/VehicleDetailService';
import { AlertsService } from './alerts/AlertsService';
import { InfotextsService } from './infotexts/InfotextsService';
import { GtfsRtVehicleDetailEnricher } from './vehicles/GtfsRtVehicleDetailEnricher';
import type { VehicleDetailEnricher } from './vehicles/VehicleDetailEnricher';
import { VehiclesService } from './vehicles/VehiclesService';
import type { VehicleSource } from './vehicles/vehicle-source';
import { GtfsRtVehicleSource } from './vehicles/gtfs-rt-vehicle-source';
import { createGtfsAlertsMapper, type AlertsMapper } from './alerts/alerts-mapper';
import { decodeAlertEntity } from '../../_core/gtfsRtAlerts';
import { getGtfsRtFeed } from '../../_feeds/gtfs/gtfs-rt-feed';

/**
 * What a city built on the GTFS stack does differently. Everything omitted is the GTFS default: a
 * GTFS-RT feed for vehicles, timetable departures and detail, and alerts from the same feed.
 */
export interface GtfsOverrides {
    /** Where vehicles come from; the default reads the city's GTFS-RT feed. */
    vehicleSource?: VehicleSource;
    enricher?: (vehicles: VehiclesService) => VehicleDetailEnricher;
    alertsMapper?: AlertsMapper;
    departures?: (vehicles: VehiclesService) => DeparturesUseCase;
    /** Wraps the timetable detail, for vehicles the timetable does not cover. */
    detail?: (timetable: VehicleDetailUseCase, vehicles: VehiclesService) => VehicleDetailUseCase;
    alerts?: AlertsUseCase;
    debugFeed?: DebugFeed;
}

/** The use-cases of a city on the GTFS stack. */
export function gtfsUseCases(config: CityConfig, overrides: GtfsOverrides = {}): CityUseCases {
    const vehicles = new VehiclesService(config, overrides.vehicleSource ?? new GtfsRtVehicleSource(config));
    const timetableDetail = new VehicleDetailService(config, overrides.enricher?.(vehicles) ?? new GtfsRtVehicleDetailEnricher(vehicles));

    return {
        vehicles,
        departures: overrides.departures?.(vehicles) ?? new DeparturesService(config, vehicles),
        detail: overrides.detail?.(timetableDetail, vehicles) ?? timetableDetail,
        alerts: overrides.alerts ?? new AlertsService(config, overrides.alertsMapper ?? createGtfsAlertsMapper()),
        infotexts: new InfotextsService(config),
        debugFeed: overrides.debugFeed ?? {
            async getRawFeed(_ctx, type) {
                const feed = await getGtfsRtFeed(config);
                return type === 'alerts' ? feed.alertEntities.map(decodeAlertEntity) : feed.entity;
            },
        },
    };
}
