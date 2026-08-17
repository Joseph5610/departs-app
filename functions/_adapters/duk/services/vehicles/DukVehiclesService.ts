import type { CityConfig } from '../../../../_core/city-config';
import type { AppVehicleCollection, AppVehicleFeature, AppVehicleDetail } from '../../../../_core/types';
import { CacheManager, CACHE_TTL } from '../../../../_core/utils/CacheManager';
import type { DukTrafficResponse, DukVehicle } from '../../types';
import { DUK_STATE_MAPPING, getDukRouteTypeFromLineName } from '../../utils/dukConstants';
import { getDukVehicleColor } from '../../utils/colors';

export class DukVehiclesService {
    constructor(private city: CityConfig) {}
    
    private async getStationNames(): Promise<Record<number, string>> {
        return CacheManager.getOrFetch<Record<number, string>>(
            'duk_station_names',
            3600000, // 1 hour
            async () => {
                try {
                    const baseUrl = this.city.adapterConfig?.baseUrl;
                    const response = await fetch(`${baseUrl}/GetStations`, {
                        headers: { 'Accept': 'application/json' }
                    });

                    if (!response.ok) return {};

                    const data = await response.json() as { ItemList: { Node: number, Name: string }[] };
                    const names: Record<number, string> = {};
                    for (const item of data.ItemList || []) {
                        if (item.Name && !names[item.Node]) {
                            names[item.Node] = item.Name;
                        }
                    }
                    return names;
                } catch {
                    return {};
                }
            }
        );
    }

    /**
     * Maps a raw DukVehicle payload into the standard AppVehicleFeature for the live map.
     */
    private mapVehicle(v: DukVehicle, nodeNames: Record<number, string>): AppVehicleFeature {
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
                ...(v.FinalNode && nodeNames[v.FinalNode] ? { trip_headsign: nodeNames[v.FinalNode] } : v.FinalNode ? { trip_headsign: String(v.FinalNode) } : {}),
                bearing: v.Azimut || null,
                delay: v.Delay ? v.Delay * 60 : 0, // Delay is in minutes, convert to seconds
                route_color: getDukVehicleColor(route_type, lineName),
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
            CACHE_TTL.SHORT_DEBOUNCE_MS,
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
                const nodeNames = await this.getStationNames();

                for (const v of data.VehicleList || []) {
                    if (!v.Latitude || !v.Longitude) continue;
                    features.push(this.mapVehicle(v, nodeNames));
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
    async getSingleLiveVehicle(vehicleId: string | null, tripId: string | null): Promise<AppVehicleDetail | null> {
        return CacheManager.getOrFetch<AppVehicleDetail | null>(
            `duk_vehicle_detail_${vehicleId || tripId}`,
            CACHE_TTL.SHORT_DEBOUNCE_MS,
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
                const vehicle = data.VehicleList?.find(v => 
                    (vehicleId && String(v.ID) === vehicleId) || 
                    (tripId && v.qride_tripID === tripId)
                );

                if (!vehicle) {
                    return null;
                }

                const nodeNames = await this.getStationNames();
                const feature = this.mapVehicle(vehicle, nodeNames);

                const liveMatch: AppVehicleDetail = {
                    ...feature.properties,
                    geometry: feature.geometry as AppVehicleDetail['geometry'],
                    stop_times: { features: [] },
                    route_geojson: undefined // Not available for DUK
                };

                // Construct a minimal timeline
                let seq = 1;
                const extractTime = (str: string) => {
                    if (!str) return str;
                    const parts = str.split(/[\sT]/);
                    return parts.length > 1 ? parts[1] : str;
                };

                if (vehicle.StationNode) {
                    liveMatch.stop_times!.features.push({
                        type: 'Feature',
                        properties: {
                            stop_id: 'incomplete-gap-start',
                            stop_name: '...',
                            stop_sequence: seq++,
                            arrival_time: '',
                            departure_time: ''
                        }
                    });

                    liveMatch.stop_times!.features.push({
                        type: 'Feature',
                        properties: {
                            stop_id: String(vehicle.StationNode),
                            stop_name: nodeNames[vehicle.StationNode] || String(vehicle.StationNode),
                            stop_sequence: seq++,
                            arrival_time: extractTime(vehicle.ArrivalDT) || '',
                            departure_time: extractTime(vehicle.TODepartureDT) || ''
                        }
                    });
                }

                if (vehicle.FinalNode && vehicle.FinalNode !== vehicle.StationNode) {
                    liveMatch.stop_times!.features.push({
                        type: 'Feature',
                        properties: {
                            stop_id: 'incomplete-gap',
                            stop_name: '...',
                            stop_sequence: seq++,
                            arrival_time: '',
                            departure_time: ''
                        }
                    });

                    liveMatch.stop_times!.features.push({
                        type: 'Feature',
                        properties: {
                            stop_id: String(vehicle.FinalNode),
                            stop_name: nodeNames[vehicle.FinalNode] || String(vehicle.FinalNode),
                            stop_sequence: seq,
                            arrival_time: '',
                            departure_time: ''
                        }
                    });
                }

                return liveMatch;
            }
        );
    }
}
