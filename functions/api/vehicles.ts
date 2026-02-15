import { GOLEMIO_API, CACHE_CONFIG } from '../_utils/config';
import { applyJitter, normalizeVehicleFeature } from '../_utils/transit-utils';

interface Env {
    GOLEMIO_API_KEY: string;
}

interface GolemioVehicleFeature {
    type: 'Feature';
    geometry: any;
    properties: {
        vehicle_id?: string;
        trip?: {
            gtfs?: {
                trip_id?: string;
                route_short_name?: string;
                route_type?: string;
                trip_headsign?: string;
            };
            wheelchair_accessible?: boolean;
            air_conditioned?: boolean;
            vehicle_registration_number?: number;
        };
        last_position?: {
            bearing?: number;
            delay?: { actual?: number };
            state_position?: string;
            next_stop?: { id?: string };
        };
    };
}

// Flat structure used by the public endpoint and our app
interface PublicVehicleProperties {
    vehicle_id: string;
    gtfs_trip_id?: string;
    trip_id?: string;
    route_short_name?: string;
    gtfs_route_short_name?: string;
    route_type?: string;
    trip_headsign?: string;
    gtfs_trip_headsign?: string;
    bearing?: number;
    delay: number;
    state_position?: string;
    next_stop_name?: string;
    is_wheelchair_accessible?: boolean;
    is_air_conditioned?: boolean;
    vehicle_registration_number?: number;
}


/**
 * Cloudflare Pages Function to fetch and normalize Golemio vehicle data.
 * Supports fetching by bounding box, specific trip ID, or both combined.
 */
export const onRequest: PagesFunction<Env> = async (context) => {
    const { request, env } = context;
    const url = new URL(request.url);
    const bounds = url.searchParams.get("bounds");
    const routeType = url.searchParams.get("routeType");
    const tripId = url.searchParams.get("tripId");

    const routeShortNames = url.searchParams.getAll("routeShortName");

    let allFeatures: any[] = [];

    try {
        const headers = {
            "X-Access-Token": env.GOLEMIO_API_KEY,
            "Content-Type": "application/json"
        };

        if (tripId && bounds) {
            // COMBINED: Fetch both and merge
            // Use standard endpoint for Trip ID (more reliable)
            const tripUrlString = `${GOLEMIO_API.BASE_URL}${GOLEMIO_API.ENDPOINTS.VEHICLE_POSITIONS}?tripId=${tripId}`;

            // Use public endpoint for bounding box (often faster for high volume)
            const boundsUrl = new URL(`${GOLEMIO_API.BASE_URL}/public${GOLEMIO_API.ENDPOINTS.VEHICLE_POSITIONS}`);
            boundsUrl.searchParams.set("boundingBox", bounds);
            if (routeType) boundsUrl.searchParams.set("routeType", routeType);
            routeShortNames.forEach(rsn => boundsUrl.searchParams.append("routeShortName", rsn));

            const [tripRes, boundsRes] = await Promise.all([
                fetch(tripUrlString, { headers, cf: { cacheTtl: CACHE_CONFIG.DEFAULT_TTL, cacheEverything: true } } as any),
                fetch(boundsUrl.toString(), { headers, cf: { cacheTtl: CACHE_CONFIG.DEFAULT_TTL, cacheEverything: true } } as any)
            ]);

            const tripData: any = tripRes.ok ? await tripRes.json() : null;
            const boundsData: any = boundsRes.ok ? await boundsRes.json() : { features: [] };

            let tripFeaturesFromData: any[] = [];
            if (tripData) {
                if (tripData.type === 'FeatureCollection') {
                    tripFeaturesFromData = tripData.features || [];
                } else if (tripData.type === 'Feature') {
                    tripFeaturesFromData = [tripData];
                }
            }

            const normalizedTripFeatures = tripFeaturesFromData
                .filter(f => f.geometry && f.geometry.coordinates)
                .map(feature => normalizeVehicleFeature(feature, tripId));

            const normalizedBoundsFeatures = (boundsData.features || [])
                .filter((f: any) => f.geometry && f.geometry.coordinates)
                .map((feature: any) => normalizeVehicleFeature(feature));

            allFeatures = [...normalizedBoundsFeatures, ...normalizedTripFeatures];
        } else if (tripId || bounds || routeShortNames.length > 0) {
            // SINGLE MODE
            let golemioUrl: string;
            if (tripId) {
                // Trip ID lookup is better on the standard endpoint
                golemioUrl = `${GOLEMIO_API.BASE_URL}${GOLEMIO_API.ENDPOINTS.VEHICLE_POSITIONS}?tripId=${tripId}`;
            } else {
                // Multiple route/bounds filtering
                const bUrl = new URL(`${GOLEMIO_API.BASE_URL}/public${GOLEMIO_API.ENDPOINTS.VEHICLE_POSITIONS}`);
                if (bounds) bUrl.searchParams.set("boundingBox", bounds);
                if (routeType) bUrl.searchParams.set("routeType", routeType);
                routeShortNames.forEach(rsn => bUrl.searchParams.append("routeShortName", rsn));
                golemioUrl = bUrl.toString();
            }

            const response = await fetch(golemioUrl, {
                headers,
                cf: { cacheTtl: CACHE_CONFIG.DEFAULT_TTL, cacheEverything: true }
            } as any);

            if (!response.ok) {
                return new Response(`Golemio API Error: ${response.status}`, { status: response.status });
            }

            const data: any = await response.json();

            if (tripId) {
                let featuresFromData: any[] = [];
                if (data.type === 'FeatureCollection') {
                    featuresFromData = data.features || [];
                } else if (data.type === 'Feature') {
                    featuresFromData = [data];
                }
                allFeatures = featuresFromData
                    .filter(f => f.geometry && f.geometry.coordinates)
                    .map(f => normalizeVehicleFeature(f, tripId));
            } else {
                allFeatures = (data.features || [])
                    .filter((f: any) => f.geometry && f.geometry.coordinates)
                    .map((feature: any) => normalizeVehicleFeature(feature));
            }
        } else {
            return new Response("Missing parameters", { status: 400 });
        }

        const features = applyJitter(allFeatures);

        return new Response(JSON.stringify({ type: 'FeatureCollection', features }), {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": `public, max-age=${CACHE_CONFIG.DEFAULT_TTL}, s-maxage=${CACHE_CONFIG.DEFAULT_TTL}`,
            },
        });
    } catch (err) {
        return new Response(`Internal Server Error: ${err instanceof Error ? err.message : String(err)}`, { status: 500 });
    }
};
