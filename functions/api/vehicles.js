export const onRequest = async (context) => {
    const { request, env } = context;
    const url = new URL(request.url);
    const bounds = url.searchParams.get("bounds");
    const routeType = url.searchParams.get("routeType");
    const tripId = url.searchParams.get("tripId");
    let golemioUrl;
    if (tripId) {
        // Use the gtfsTripId endpoint - returns a single Feature
        golemioUrl = new URL(`https://api.golemio.cz/v2/vehiclepositions/${tripId}`);
    }
    else if (bounds) {
        // Use the public bounding box endpoint - returns FeatureCollection
        golemioUrl = new URL("https://api.golemio.cz/v2/public/vehiclepositions");
        golemioUrl.searchParams.set("boundingBox", bounds);
        if (routeType) {
            golemioUrl.searchParams.set("routeType", routeType);
        }
    }
    else {
        return new Response("Missing 'bounds' or 'tripId' parameter.", { status: 400 });
    }
    try {
        const response = await fetch(golemioUrl.toString(), {
            headers: {
                "X-Access-Token": env.GOLEMIO_API_KEY,
                "Content-Type": "application/json",
            },
            cf: {
                cacheTtl: 10,
                cacheEverything: true,
            }
        });
        if (!response.ok) {
            return new Response(`Golemio API Error: ${response.status} ${response.statusText}`, { status: response.status });
        }
        const data = await response.json();
        let normalizedData;
        // Handle single vehicle lookup (filtering by ID returns FeatureCollection)
        if (tripId) {
            let feature = null;
            if (data.type === 'FeatureCollection' && data.features && data.features.length > 0) {
                feature = data.features[0];
            }
            else if (data.type === 'Feature') {
                feature = data;
            }
            if (feature) {
                // Full details for single vehicle lookup
                const flatProperties = {
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
                    features: [{
                            type: 'Feature',
                            geometry: feature.geometry,
                            properties: flatProperties
                        }]
                };
            }
            else {
                // Return empty collection if not found
                normalizedData = { type: 'FeatureCollection', features: [] };
            }
        }
        else if (bounds) {
            // Pass the data directly intact as received from Golemio
            normalizedData = data;
        }
        else {
            normalizedData = data;
        }
        return new Response(JSON.stringify(normalizedData), {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=10, s-maxage=10",
            },
        });
    }
    catch (err) {
        return new Response(`Internal Server Error: ${err}`, { status: 500 });
    }
};
