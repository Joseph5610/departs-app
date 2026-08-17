import type { CityConfig } from '../../../../_core/city-config';
import type { Env, AppDepartureResponse, AppDeparture, AppRouteType } from '../../../../_core/types';
import { CacheManager, CACHE_TTL } from '../../../../_core/utils/CacheManager';
import { ApiError } from '../../../../_core/errors';
import { ERROR_MESSAGES } from '../../../../_core/api-utils';
import type { DukDeparturesResponse } from '../../types';
import { DUK_TRACTION_MAPPING } from '../../utils/dukConstants';
import { getDukVehicleColor } from '../../utils/colors';

export class DukDeparturesService {

    constructor(private city: CityConfig) {}
    
    /**
     * Fetches departures for a specific station/pole.
     * Caches requests per node/post combination.
     */
    async getDepartures(_env: Env, searchParams: URLSearchParams): Promise<AppDepartureResponse> {
        const ids = searchParams.get('ids') || searchParams.get('stopId');
        if (!ids) {
            throw new ApiError(ERROR_MESSAGES.MISSING_PARAMS, 400);
        }

        // We only take the first ID to determine the node for simplicity.
        // If it's a centroid or platform, we can just fetch the whole node (post = 0)
        // and optionally filter.
        const firstId = ids.split(',')[0];
        let node = '';
        let post = '0';
        let requestedPosts: Set<string> | null = null;

        if (firstId.startsWith('centroid-duk-')) {
            node = firstId.replace('centroid-duk-', '');
            post = '0';
        } else if (firstId.startsWith('duk-')) {
            const parts = firstId.split('-'); // duk-1734-1
            if (parts.length >= 3) {
                node = parts[1];
                const allPosts = ids.split(',').map(id => id.split('-')[2]);
                if (allPosts.length === 1) {
                    // Fetch exactly this pole from upstream API to avoid truncation limits
                    post = allPosts[0];
                } else {
                    // Fetch all and filter locally
                    post = '0';
                    requestedPosts = new Set(allPosts);
                }
            }
        }

        if (!node) {
            return { departures: [] };
        }

        // The cache key MUST include the exact IDs requested, otherwise if we filter by pole 1, 
        // it caches pole 1's departures under the generic node key, and clicking pole 2 returns pole 1's data.
        const cacheKey = `duk_departures_${node}_${post}_${ids}`;
        return CacheManager.getOrFetch<AppDepartureResponse>(
            cacheKey,
            CACHE_TTL.SHORT_DEBOUNCE_MS,
            async () => {
                const baseUrl = this.city.adapterConfig?.baseUrl;
                const response = await fetch(`${baseUrl}/GetStationDeparturesWCount/${node}/${post}/30/0`, {
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                if (!response.ok) {
                    console.error('Failed to fetch DUK departures:', response.status);
                    throw new ApiError(ERROR_MESSAGES.UPSTREAM_ERROR(response.status), response.status);
                }

                const data = await response.json() as DukDeparturesResponse;
                const departures: AppDeparture[] = [];

                for (const dep of data.DeparturesList || []) {
                    // Filter by requested posts if applicable
                    const depPost = String(dep.StationPost);
                    
                    // We filtered out 999 from our structural mapping.
                    // If the upstream API still returns a departure on post 999, we should map it to post '1'
                    // as 999 is just an alias for 1.
                    const mappedPost = depPost === '999' ? '1' : depPost;
                    
                    if (requestedPosts && !requestedPosts.has(mappedPost)) {
                        continue;
                    }

                    // Parse Delay ("0:00:00" -> seconds)
                    let delaySeconds = 0;
                    if (dep.Delay && typeof dep.Delay === 'string') {
                        const parts = dep.Delay.split(':');
                        if (parts.length === 3) {
                            delaySeconds = parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
                        }
                    }

                    const routeType = (DUK_TRACTION_MAPPING[dep.Traction] || 'bus') as AppRouteType;
                    const lineName = String(dep.LineName || '');
                    const safeDateStr = (str: string) => str ? str.replace(' ', 'T') : str;

                    departures.push({
                        timestamp: safeDateStr(dep.DepartureDT),
                        scheduled: safeDateStr(dep.TODepartureDT),
                        delay: delaySeconds,
                        line: lineName,
                        type: routeType,
                        directionId: '0',
                        headsign: dep.Direction || '',
                        isCanceled: false,
                        tripId: undefined, // GTFS trip ID isn't directly exposed here unless we fetch full GTFS
                        vehicleId: undefined,
                        platform: mappedPost,
                        route_color: getDukVehicleColor(routeType, lineName),
                        is_wheelchair_accessible: null,
                        is_air_conditioned: null,
                        stopId: `duk-${node}-${mappedPost}`
                    });
                }

                return { departures };
            }
        );
    }
}
