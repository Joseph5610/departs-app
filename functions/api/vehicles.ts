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
 * Processes a collection of features by:
 * 1. Deduplicating by vehicle_id.
 * 2. Applying circular jittering to stacked vehicles.
 */
const processFeatures = (allFeatures: any[]): any[] => {
    const seen = new Set<string>();
    const uniqueFeatures: any[] = [];

    for (const f of allFeatures) {
        const id = String(f.properties.vehicle_id || f.properties.id || '');
        if (id && !seen.has(id)) {
            seen.add(id);
            uniqueFeatures.push(f);
        }
    }

    const groups: Record<string, any[]> = {};
    uniqueFeatures.forEach((f) => {
        const key = f.geometry.coordinates.join(',');
        if (!groups[key]) groups[key] = [];
        groups[key].push(f);
    });

    const jitteredFeatures: any[] = [];
    const BASE_JITTER_RADIUS = 0.00012;

    Object.values(groups).forEach(group => {
        if (group.length === 1) {
            jitteredFeatures.push(group[0]);
        } else {
            const count = group.length;
            const angleStep = (2 * Math.PI) / count;

            group.forEach((f, index) => {
                const [lng, lat] = f.geometry.coordinates;
                const angle = index * angleStep;
                let currentRadius = BASE_JITTER_RADIUS;
                if (count > 4) {
                    currentRadius = index % 2 === 0 ? BASE_JITTER_RADIUS * 0.8 : BASE_JITTER_RADIUS * 1.35;
                }

                jitteredFeatures.push({
                    ...f,
                    geometry: {
                        ...f.geometry,
                        coordinates: [
                            lng + currentRadius * Math.cos(angle) * 1.3,
                            lat + currentRadius * Math.sin(angle)
                        ]
                    }
                });
            });
        }
    });

    return jitteredFeatures;
};

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

    let allFeatures: any[] = [];

    try {
        if (tripId && bounds) {
            // COMBINED: Fetch both and merge
            const tripUrlString = `https://api.golemio.cz/v2/vehiclepositions/${tripId}`;
            const boundsUrl = new URL("https://api.golemio.cz/v2/public/vehiclepositions");
            boundsUrl.searchParams.set("boundingBox", bounds);
            if (routeType) boundsUrl.searchParams.set("routeType", routeType);

            const [tripRes, boundsRes] = await Promise.all([
                fetch(tripUrlString, {
                    headers: { "X-Access-Token": env.GOLEMIO_API_KEY, "Content-Type": "application/json" },
                    cf: { cacheTtl: 10, cacheEverything: true }
                }),
                fetch(boundsUrl.toString(), {
                    headers: { "X-Access-Token": env.GOLEMIO_API_KEY, "Content-Type": "application/json" },
                    cf: { cacheTtl: 10, cacheEverything: true }
                })
            ]);

            const tripData: any = tripRes.ok ? await tripRes.json() : null;
            const boundsData: any = boundsRes.ok ? await boundsRes.json() : { features: [] };

            let tripFeaturesFromData: GolemioVehicleFeature[] = [];
            if (tripData) {
                if (tripData.type === 'FeatureCollection') {
                    tripFeaturesFromData = tripData.features || [];
                } else if (tripData.type === 'Feature') {
                    tripFeaturesFromData = [tripData];
                }
            }

            // Normalize trip features
            const normalizedTripFeatures = tripFeaturesFromData.map(feature => ({
                type: 'Feature',
                geometry: feature.geometry,
                properties: {
                    vehicle_id: feature.properties.vehicle_id || `trip-${feature.properties.trip?.gtfs?.trip_id || tripId || 'unknown'}`,
                    gtfs_trip_id: feature.properties.trip?.gtfs?.trip_id || tripId,
                    trip_id: feature.properties.trip?.gtfs?.trip_id || tripId,
                    route_short_name: feature.properties.trip?.gtfs?.route_short_name,
                    gtfs_route_short_name: feature.properties.trip?.gtfs?.route_short_name,
                    route_type: feature.properties.trip?.gtfs?.route_type,
                    trip_headsign: feature.properties.trip?.gtfs?.trip_headsign,
                    gtfs_trip_headsign: feature.properties.trip?.gtfs?.trip_headsign,
                    bearing: feature.properties.last_position?.bearing,
                    delay: feature.properties.last_position?.delay?.actual || 0,
                    state_position: feature.properties.last_position?.state_position,
                    next_stop_name: feature.properties.last_position?.next_stop?.id,
                    is_wheelchair_accessible: feature.properties.trip?.wheelchair_accessible,
                    is_air_conditioned: feature.properties.trip?.air_conditioned,
                    vehicle_registration_number: feature.properties.trip?.vehicle_registration_number,
                }
            }));

            allFeatures = [...(boundsData.features || []), ...normalizedTripFeatures];
        } else if (tripId || bounds) {
            // SINGLE MODE
            let golemioUrl: string;
            if (tripId) {
                golemioUrl = `https://api.golemio.cz/v2/vehiclepositions/${tripId}`;
            } else {
                const bUrl = new URL("https://api.golemio.cz/v2/public/vehiclepositions");
                bUrl.searchParams.set("boundingBox", bounds!);
                if (routeType) bUrl.searchParams.set("routeType", routeType);
                golemioUrl = bUrl.toString();
            }

            const response = await fetch(golemioUrl, {
                headers: {
                    "X-Access-Token": env.GOLEMIO_API_KEY,
                    "Content-Type": "application/json",
                },
                cf: { cacheTtl: 10, cacheEverything: true }
            });

            if (!response.ok) {
                return new Response(`Golemio API Error: ${response.status}`, { status: response.status });
            }

            const data: any = await response.json();

            if (tripId) {
                let feature: GolemioVehicleFeature | null = null;
                if (data.type === 'FeatureCollection' && data.features && data.features.length > 0) {
                    feature = data.features[0];
                } else if (data.type === 'Feature') {
                    feature = data;
                }

                if (feature) {
                    allFeatures = [{
                        type: 'Feature',
                        geometry: feature.geometry,
                        properties: {
                            vehicle_id: feature.properties.vehicle_id || `trip-${feature.properties.trip?.gtfs?.trip_id || tripId || 'unknown'}`,
                            gtfs_trip_id: feature.properties.trip?.gtfs?.trip_id || tripId,
                            trip_id: feature.properties.trip?.gtfs?.trip_id || tripId,
                            route_short_name: feature.properties.trip?.gtfs?.route_short_name,
                            gtfs_route_short_name: feature.properties.trip?.gtfs?.route_short_name,
                            route_type: feature.properties.trip?.gtfs?.route_type,
                            trip_headsign: feature.properties.trip?.gtfs?.trip_headsign,
                            gtfs_trip_headsign: feature.properties.trip?.gtfs?.trip_headsign,
                            bearing: feature.properties.last_position?.bearing,
                            delay: feature.properties.last_position?.delay?.actual || 0,
                            state_position: feature.properties.last_position?.state_position,
                            next_stop_name: feature.properties.last_position?.next_stop?.id,
                            is_wheelchair_accessible: feature.properties.trip?.wheelchair_accessible,
                            is_air_conditioned: feature.properties.trip?.air_conditioned,
                            vehicle_registration_number: feature.properties.trip?.vehicle_registration_number,
                        }
                    }];
                }
            } else {
                allFeatures = data.features || [];
            }
        } else {
            return new Response("Missing parameters", { status: 400 });
        }

        // Apply deduplication and jittering
        const features = processFeatures(allFeatures);

        return new Response(JSON.stringify({ type: 'FeatureCollection', features }), {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=10, s-maxage=10",
            },
        });
    } catch (err) {
        return new Response(`Internal Server Error: ${err instanceof Error ? err.message : String(err)}`, { status: 500 });
    }
};
