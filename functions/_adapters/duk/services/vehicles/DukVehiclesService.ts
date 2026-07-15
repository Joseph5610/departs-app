import type { CityConfig } from '../../../../_core/city-config';
import type { AppVehicleCollection, AppVehicleFeature, AppVehicleDetail } from '../../../../_core/types';
import { CacheManager, CACHE_TTL } from '../../../../_core/utils/CacheManager';
import type { DukTrafficResponse, DukVehicle } from '../../types';
import { DUK_STATE_MAPPING, getDukRouteTypeFromLineName } from '../../utils/dukConstants';

export class DukVehiclesService {
    constructor(private city: CityConfig) {}
    
    /**
     * Maps a raw DukVehicle payload into the standard AppVehicleFeature for the live map.
     */
    private mapVehicle(v: DukVehicle): AppVehicleFeature {
        const lineName = v.qride_linename || String(v.LineID || '');
        const route_type = getDukRouteTypeFromLineName(lineName);
        const safeDateStr = (str: string) => str ? str.replace(' ', 'T') : str;

        return {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [v.Longitude, v.Latitude]
            },
            properties: {
                vehicle_id: String(v.ID),
                gtfs_trip_id: v.qride_tripID || `dummy-${v.ID}`,
                route_short_name: lineName,
                route_type: route_type,
                trip_headsign: v.FinalNode ? String(v.FinalNode) : '',
                bearing: v.Azimut || null,
                delay: v.Delay ? v.Delay * 60 : 0, // Delay is in minutes, convert to seconds
                route_color: '#2563EB', // Blue placeholder
                is_night: false,
                state_position: DUK_STATE_MAPPING[v.State] || 'unknown',
                // Portabo API has a bug where SŽ trains report GPSPositionDT exactly 2 hours in the future.
                // LastActivityDT is correctly synchronized across all carriers (buses and trains).
                origin_timestamp: safeDateStr(v.LastActivityDT || v.GPSPositionDT),
                vehicle_descriptor: {
                    is_wheelchair_accessible: v.HasLowfloor,
                    is_air_conditioned: v.isAirConditioned === true ? true : v.isAirConditioned === false ? false : null
                }
            }
        };
    }

    /**
     * Fetches the entire real-time feed for DUK.
     * Implements aggressive memory caching to prevent cache stampedes towards the upstream provider.
     */
    async getVehicles(): Promise<AppVehicleCollection> {
        return CacheManager.getOrFetch<AppVehicleCollection>(
            'duk_vehicles',
            CACHE_TTL.TEN_SECONDS_MS,
            async () => {
                const baseUrl = this.city.adapterConfig?.baseUrl;
                const response = await fetch(`${baseUrl}/GetTraffic/0`, {
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                if (!response.ok) {
                    console.error('Failed to fetch DUK traffic:', response.status);
                    return {
                        type: 'FeatureCollection',
                        features: [],
                        status: 'upstream_offline',
                        last_updated: new Date().toISOString()
                    };
                }

                const data = await response.json() as DukTrafficResponse;
                const features: AppVehicleFeature[] = [];

                for (const v of data.VehicleList || []) {
                    if (!v.Latitude || !v.Longitude) continue;
                    features.push(this.mapVehicle(v));
                }

                return {
                    type: 'FeatureCollection',
                    features,
                    status: 'ok',
                    last_updated: new Date().toISOString()
                };
            }
        );
    }

    /**
     * Fetches a specific vehicle's real-time detail by hunting for it inside the full traffic feed.
     */
    async getSingleLiveVehicle(vehicleId: string): Promise<AppVehicleDetail | null> {
        return CacheManager.getOrFetch<AppVehicleDetail | null>(
            `duk_vehicle_detail_${vehicleId}`,
            CACHE_TTL.TEN_SECONDS_MS,
            async () => {
                const baseUrl = this.city.adapterConfig?.baseUrl;
                const response = await fetch(`${baseUrl}/GetTraffic/0`, {
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                if (!response.ok) {
                    return null;
                }

                const data = await response.json() as DukTrafficResponse;
                const vehicle = data.VehicleList?.find(v => String(v.ID) === vehicleId);

                if (!vehicle) {
                    return null;
                }

                const feature = this.mapVehicle(vehicle);

                const liveMatch: AppVehicleDetail = {
                    ...feature.properties,
                    geometry: feature.geometry as AppVehicleDetail['geometry'],
                    stop_times: undefined, // Not available for DUK
                    route_geojson: undefined // Not available for DUK
                };

                return liveMatch;
            }
        );
    }
}
