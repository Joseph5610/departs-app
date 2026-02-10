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

export const onRequest: PagesFunction<Env> = async (context) => {
    const { request, env } = context;
    const url = new URL(request.url);
    const bounds = url.searchParams.get("bounds");
    const routeType = url.searchParams.get("routeType");
    const tripId = url.searchParams.get("tripId");

    let normalizedData: any = null;

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

            let tripFeatures: any[] = [];
            if (tripData) {
                if (tripData.type === 'FeatureCollection') {
                    tripFeatures = tripData.features || [];
                } else if (tripData.type === 'Feature') {
                    tripFeatures = [tripData];
                }
            }

            const boundsFeatures = boundsData.features || [];
            const mergedFeatures = [...boundsFeatures];
            const seenIds = new Set(boundsFeatures.map((f: any) => f.properties.vehicle_id));

            tripFeatures.forEach((feature: any) => {
                const vid = feature.properties.vehicle_id || feature.properties.id;
                if (!vid || !seenIds.has(vid)) {
                    const flatProperties: PublicVehicleProperties = {
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
                    };
                    mergedFeatures.push({
                        type: 'Feature',
                        geometry: feature.geometry,
                        properties: flatProperties
                    });
                }
            });

            normalizedData = { type: 'FeatureCollection', features: mergedFeatures };
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
                let feature = null;
                if (data.type === 'FeatureCollection' && data.features && data.features.length > 0) {
                    feature = data.features[0];
                } else if (data.type === 'Feature') {
                    feature = data;
                }

                if (feature) {
                    const flatProperties: PublicVehicleProperties = {
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
                    };
                    normalizedData = {
                        type: 'FeatureCollection',
                        features: [{ type: 'Feature', geometry: feature.geometry, properties: flatProperties }]
                    };
                } else {
                    normalizedData = { type: 'FeatureCollection', features: [] };
                }
            } else {
                normalizedData = data;
            }
        } else {
            return new Response("Missing parameters", { status: 400 });
        }

        return new Response(JSON.stringify(normalizedData), {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=10, s-maxage=10",
            },
        });
    } catch (err) {
        return new Response(`Internal Server Error: ${err}`, { status: 500 });
    }
};
