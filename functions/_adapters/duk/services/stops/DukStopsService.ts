import type { CityConfig } from '../../../../_core/city-config';
import type { AppStopCollection, AppStopFeature } from '../../../../_core/types';
import { ApiError } from '../../../../_core/errors';
import { ERROR_MESSAGES } from '../../../../_core/api-utils';

interface DukStationItem {
    Node: number;
    Post: number;
    Name: string;
    Latitude: number;
    Longitude: number;
    Zone: number;
}

export class DukStopsService {
    constructor(private city: CityConfig) {}

    /**
     * Fetches all stops from the upstream Portabo API.
     */
    async getStops(): Promise<AppStopCollection> {
        const baseUrl = this.city.adapterConfig?.baseUrl;
        const response = await fetch(`${baseUrl}/GetStations`, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            console.error('Failed to fetch DUK stations:', response.status);
            throw new ApiError(ERROR_MESSAGES.UPSTREAM_ERROR(response.status), response.status);
        }

        const data = await response.json() as { ItemList: DukStationItem[] };
        const features: AppStopFeature[] = [];

        // Group by Node
        const nodes = new Map<number, DukStationItem[]>();
        for (const item of data.ItemList || []) {
            if (item.Post === 999) continue; // Filter out virtual catch-all platforms
            
            if (!nodes.has(item.Node)) {
                nodes.set(item.Node, []);
            }
            nodes.get(item.Node)!.push(item);
        }

        for (const [nodeId, posts] of nodes.entries()) {
            // Find a valid coordinate for the centroid
            let centroidLat = 0;
            let centroidLon = 0;
            let name = `Node ${nodeId}`;
            let zoneId = '';

            const validPosts = posts.filter(p => p.Latitude > 0 && p.Longitude > 0);
            if (validPosts.length > 0) {
                centroidLat = validPosts[0].Latitude;
                centroidLon = validPosts[0].Longitude;
                name = validPosts[0].Name || name;
                zoneId = String(validPosts[0].Zone || '');
            } else if (posts.length > 0) {
                // All posts have 0,0 - try to use the first one anyway, but it won't render well
                name = posts[0].Name || name;
                zoneId = String(posts[0].Zone || '');
            }

            // Create Centroid
            if (centroidLat > 0 && centroidLon > 0) {
                const allIds = posts.map(p => `duk-${nodeId}-${p.Post}`);
                features.push({
                    type: 'Feature',
                    id: `centroid-duk-${nodeId}`,
                    geometry: {
                        type: 'Point',
                        coordinates: [centroidLon, centroidLat]
                    },
                    properties: {
                        stop_id: `centroid-duk-${nodeId}`,
                        stop_name: name,
                        location_type: 1, // Station
                        parent_station: null,
                        zone_id: zoneId,
                        is_centroid: true,
                        all_ids: allIds
                    }
                });
            }

            // Create Posts
            for (const post of posts) {
                if (post.Latitude > 0 && post.Longitude > 0) {
                    features.push({
                        type: 'Feature',
                        id: `duk-${nodeId}-${post.Post}`,
                        geometry: {
                            type: 'Point',
                            coordinates: [post.Longitude, post.Latitude]
                        },
                        properties: {
                            stop_id: `duk-${nodeId}-${post.Post}`,
                            stop_name: post.Name || name,
                            platform_code: String(post.Post),
                            location_type: 0, // Stop
                            parent_station: `centroid-duk-${nodeId}`,
                            zone_id: String(post.Zone || zoneId)
                        }
                    });
                }
            }
        }

        return {
            type: 'FeatureCollection',
            features
        };
    }
}
