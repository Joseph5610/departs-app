import type { EventContext } from "@cloudflare/workers-types";
import type { Env, AppStopCollection, AppDepartureResponse, AppVehicleCollection, AppAlertsResponse, AppInfotext } from "./_core/types";
import { getCityConfig } from "./_core/city-config";
import { getAdapter, type CityAdapter } from "./_adapters/CityAdapter";

/**
 * Standard CORS headers for MCP client compatibility across tools (Claude Code, Cursor, web browsers, etc.)
 */
const CORS_HEADERS: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-session-id",
};

/**
 * Tool definitions exposed to Model Context Protocol (MCP) clients.
 */
const MCP_TOOLS = [
    {
        name: "search_stops",
        description: "Search public transit stops/stations by name or query string in Prague (PID) or Brno (IDS JMK).",
        inputSchema: {
            type: "object",
            properties: {
                city: {
                    type: "string",
                    enum: ["prague", "brno"],
                    description: "City transit system (default: 'prague')."
                },
                query: {
                    type: "string",
                    description: "Stop name or keyword (e.g. 'Čakovice', 'Hlavní nádraží', 'Svoboďák')."
                },
                limit: {
                    type: "number",
                    description: "Maximum number of search results to return (default: 10)."
                }
            },
            required: ["query"]
        }
    },
    {
        name: "get_next_departures",
        description: "Get real-time upcoming public transit departures from a SPECIFIC stop name or stop ID in Prague (PID) or Brno (IDS JMK). Use when the user specifies a stop name (e.g., 'Hlavní nádraží', 'Sídliště Čakovice') or stop ID. Includes inline stop notice Banners/Infotexts.",
        inputSchema: {
            type: "object",
            properties: {
                city: {
                    type: "string",
                    enum: ["prague", "brno"],
                    description: "City transit system (default: 'prague')."
                },
                stop_id: {
                    type: "string",
                    description: "Stop ID or parent station ID (e.g., 'U136Z1P' or 'U1102Z2P' for Sídliště Čakovice)."
                },
                stop_name: {
                    type: "string",
                    description: "Optional stop name search if stop_id is unknown."
                },
                latitude: {
                    type: "number",
                    description: "Optional latitude coordinate to find closest stop if stop_id/stop_name are omitted."
                },
                longitude: {
                    type: "number",
                    description: "Optional longitude coordinate to find closest stop if stop_id/stop_name are omitted."
                },
                route_type: {
                    type: "string",
                    description: "Optional transport mode filter: 'bus', 'tram', 'metro', 'train', 'trolleybus'."
                },
                line: {
                    type: "string",
                    description: "Optional line number filter (e.g., '136', '9', 'C')."
                },
                limit: {
                    type: "number",
                    description: "Max number of departures to retrieve (default: 10)."
                }
            }
        }
    },
    {
        name: "get_nearest_departures",
        description: "Get real-time upcoming departures for stops closest to a GEOGRAPHIC LOCATION (latitude and longitude) in Prague (PID) or Brno (IDS JMK). Use for proximity queries like: 'What departures are near me?', 'Will I catch the bus at 50.087, 14.421?', 'Any trams nearby?', 'Show closest departures to my location'. Can filter by route_type ('bus', 'tram', 'metro', 'train') or line number.",
        inputSchema: {
            type: "object",
            properties: {
                city: {
                    type: "string",
                    enum: ["prague", "brno"],
                    description: "City transit system (default: 'prague')."
                },
                latitude: {
                    type: "number",
                    description: "User latitude coordinate (e.g. 50.0875 for Prague)."
                },
                longitude: {
                    type: "number",
                    description: "User longitude coordinate (e.g. 14.4213 for Prague)."
                },
                radius_meters: {
                    type: "number",
                    description: "Search radius in meters around coordinates (default: 500)."
                },
                route_type: {
                    type: "string",
                    description: "Optional transport mode filter: 'bus', 'tram', 'metro', 'train', 'trolleybus'."
                },
                line: {
                    type: "string",
                    description: "Optional line number filter (e.g. '136', '9', 'C')."
                },
                limit: {
                    type: "number",
                    description: "Max number of departures per stop (default: 10)."
                }
            },
            required: ["latitude", "longitude"]
        }
    },
    {
        name: "search_nearest_stops",
        description: "Find public transit stops/stations closest to a geographic location (latitude and longitude) in Prague (PID) or Brno (IDS JMK). Returns nearest stops with distance_meters, coordinates, and serving transit lines.",
        inputSchema: {
            type: "object",
            properties: {
                city: {
                    type: "string",
                    enum: ["prague", "brno"],
                    description: "City transit system (default: 'prague')."
                },
                latitude: {
                    type: "number",
                    description: "User latitude coordinate (e.g. 50.0875)."
                },
                longitude: {
                    type: "number",
                    description: "User longitude coordinate (e.g. 14.4213)."
                },
                radius_meters: {
                    type: "number",
                    description: "Search radius in meters around coordinates (default: 1000)."
                },
                limit: {
                    type: "number",
                    description: "Max number of nearest stops to return (default: 10)."
                }
            },
            required: ["latitude", "longitude"]
        }
    },
    {
        name: "get_realtime_vehicles",
        description: "Get live vehicle positions, current delays, vehicle numbers, and status in Prague or Brno.",
        inputSchema: {
            type: "object",
            properties: {
                city: {
                    type: "string",
                    enum: ["prague", "brno"],
                    description: "City transit system (default: 'prague')."
                },
                line: {
                    type: "string",
                    description: "Optional line number filter (e.g. '136', '9', 'A')."
                },
                min_delay: {
                    type: "number",
                    description: "Filter for vehicles delayed by at least this many minutes (e.g. 3)."
                },
                limit: {
                    type: "number",
                    description: "Maximum number of live vehicles to return (default: 25)."
                }
            }
        }
    },
    {
        name: "get_service_alerts",
        description: "Get active transit service disruptions, closures, detours, and news alerts for Prague or Brno.",
        inputSchema: {
            type: "object",
            properties: {
                city: {
                    type: "string",
                    enum: ["prague", "brno"],
                    description: "City transit system (default: 'prague')."
                },
                line: {
                    type: "string",
                    description: "Optional line number filter (e.g. 'A', '17')."
                }
            }
        }
    },
    {
        name: "get_vehicle_detail",
        description: "Get detailed itinerary, stop schedule progress, vehicle specs, and delay details for a vehicle or trip.",
        inputSchema: {
            type: "object",
            properties: {
                city: {
                    type: "string",
                    enum: ["prague", "brno"],
                    description: "City transit system (default: 'prague')."
                },
                trip_id: {
                    type: "string",
                    description: "GTFS Trip ID (required for detailed vehicle schedule progress)."
                },
                vehicle_id: {
                    type: "string",
                    description: "Optional Vehicle ID."
                }
            },
            required: ["trip_id"]
        }
    }
];

interface JsonRpcRequest {
    jsonrpc: string;
    id?: string | number | null;
    method: string;
    params?: Record<string, unknown>;
}

/**
 * Creates a synthetic EventContext for invoking CityAdapter methods.
 * Reuses 100% of underlying API caching, normalization, and fetch wrappers.
 */
function createMockContext(
    ctx: EventContext<Env, string, unknown>,
    citySlug: string,
    urlPath: string,
    searchParams?: Record<string, string>
): EventContext<Env, string, unknown> {
    const url = new URL(`https://departs.app${urlPath}`);
    if (searchParams) {
        Object.entries(searchParams).forEach(([k, v]) => {
            if (v !== undefined) url.searchParams.set(k, v);
        });
    }

    const request = new Request(url.toString(), {
        headers: {
            'User-Agent': 'departs-mcp-server/1.0',
            'Accept': 'application/json'
        }
    });

    return {
        request,
        env: ctx.env,
        params: { city: citySlug },
        functionPath: urlPath,
        data: {},
        next: async () => new Response("Not found", { status: 404 }),
        waitUntil: (promise: Promise<unknown>) => ctx.waitUntil(promise)
    } as unknown as EventContext<Env, string, unknown>;
}

/**
 * Helper to get CityAdapter for a given city slug.
 */
function resolveAdapter(citySlug?: string): { adapter: CityAdapter; citySlug: string } {
    const slug = (citySlug || "prague").toLowerCase();
    const cityConfig = getCityConfig(slug);
    if (!cityConfig) {
        throw new Error(`Unsupported city '${citySlug}'. Supported cities: prague, brno.`);
    }
    return { adapter: getAdapter(cityConfig), citySlug: slug };
}

/**
 * Haversine distance in meters between two lat/lon coordinates.
 */
function calculateHaversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Route type matching helper for transit types (bus, tram, metro, train, trolleybus).
 */
function matchesRouteType(departureType: string | number, routeTypeQuery: string): boolean {
    const query = String(routeTypeQuery).trim().toLowerCase();
    const typeStr = String(departureType).trim().toLowerCase();

    if (query === typeStr) return true;

    if (query === 'bus' || query === '3') return typeStr === 'bus' || typeStr === '3';
    if (query === 'tram' || query === '0') return typeStr === 'tram' || typeStr === '0';
    if (query === 'metro' || query === '1') return typeStr === 'metro' || typeStr === '1';
    if (query === 'train' || query === 'rail' || query === '2') return typeStr === 'train' || typeStr === 'rail' || typeStr === '2';
    if (query === 'trolleybus' || query === '11' || query === '800') return typeStr === 'trolleybus' || typeStr === '11' || typeStr === '800';
    if (query === 'ferry' || query === '4') return typeStr === 'ferry' || typeStr === '4';
    if (query === 'funicular' || query === '7') return typeStr === 'funicular' || typeStr === '7';

    return false;
}

/**
 * Retrieves cached stop notice banners (infotexts) for a given stopId (0 extra cost).
 */
async function getMatchingInfotexts(
    ctx: EventContext<Env, string, unknown>,
    adapter: CityAdapter,
    resolvedCity: string,
    targetStopId: string
): Promise<AppInfotext[]> {
    try {
        const infoCtx = createMockContext(ctx, resolvedCity, `/api/${resolvedCity}/infotexts`);
        const allInfotexts = await adapter.handleInfotexts(infoCtx) as AppInfotext[];
        if (!Array.isArray(allInfotexts)) return [];

        const stopIdLower = targetStopId.toLowerCase();
        return allInfotexts.filter((info) => {
            if (!info.relatedStopIds || info.relatedStopIds.length === 0) return false;
            return info.relatedStopIds.some((sId) => String(sId).toLowerCase() === stopIdLower || stopIdLower.includes(String(sId).toLowerCase()));
        });
    } catch {
        return [];
    }
}

/**
 * Tool Execution Handlers
 */
async function handleToolCall(
    name: string,
    args: Record<string, unknown>,
    ctx: EventContext<Env, string, unknown>
): Promise<unknown> {
    const citySlug = (args?.city as string) || "prague";
    const { adapter, citySlug: resolvedCity } = resolveAdapter(citySlug);

    switch (name) {
        case "search_stops": {
            const query = String(args.query || "").trim().toLowerCase();
            const limit = Number(args.limit) || 10;
            const mockCtx = createMockContext(ctx, resolvedCity, `/api/${resolvedCity}/stops`);
            const stopsData = await adapter.handleStops(mockCtx) as AppStopCollection;

            const features = stopsData?.features || [];
            const filtered = features.filter((f) => {
                const nameMatch = f.properties?.stop_name?.toLowerCase().includes(query);
                const idMatch = String(f.properties?.stop_id || "").toLowerCase().includes(query);
                return nameMatch || idMatch;
            }).slice(0, limit);

            return {
                city: resolvedCity,
                query: args.query,
                count: filtered.length,
                stops: filtered.map((f) => ({
                    stop_id: f.properties?.stop_id,
                    stop_name: f.properties?.stop_name,
                    is_centroid: f.properties?.is_centroid,
                    coordinates: f.geometry?.coordinates,
                    lines: f.properties?.lines || []
                }))
            };
        }

        case "search_nearest_stops": {
            const lat = Number(args.latitude);
            const lon = Number(args.longitude);
            if (isNaN(lat) || isNaN(lon)) {
                return { error: "Valid 'latitude' and 'longitude' numeric coordinates are required." };
            }

            const radiusMeters = Number(args.radius_meters) || 1000;
            const limit = Number(args.limit) || 10;
            const searchCtx = createMockContext(ctx, resolvedCity, `/api/${resolvedCity}/stops`);
            const stopsData = await adapter.handleStops(searchCtx) as AppStopCollection;

            const stopsWithDistance: Array<{ feature: AppStopCollection['features'][0]; distance: number }> = [];

            for (const f of stopsData?.features || []) {
                if (f.geometry?.coordinates) {
                    const [stopLon, stopLat] = f.geometry.coordinates;
                    const dist = calculateHaversineDistanceMeters(lat, lon, stopLat, stopLon);
                    if (dist <= radiusMeters) {
                        stopsWithDistance.push({ feature: f, distance: Math.round(dist) });
                    }
                }
            }

            stopsWithDistance.sort((a, b) => a.distance - b.distance);

            return {
                city: resolvedCity,
                search_location: { latitude: lat, longitude: lon },
                radius_meters: radiusMeters,
                count: Math.min(stopsWithDistance.length, limit),
                stops: stopsWithDistance.slice(0, limit).map(({ feature: f, distance }) => ({
                    stop_id: f.properties?.stop_id,
                    stop_name: f.properties?.stop_name,
                    distance_meters: distance,
                    is_centroid: f.properties?.is_centroid,
                    coordinates: f.geometry?.coordinates,
                    lines: f.properties?.lines || []
                }))
            };
        }

        case "get_next_departures": {
            let stopId = args.stop_id as string | undefined;
            let stopNameResolved: string | undefined;
            const limit = Number(args.limit) || 10;

            // 1. If stop_id is missing but stop_name is provided, search stops
            if (!stopId && args.stop_name) {
                const searchCtx = createMockContext(ctx, resolvedCity, `/api/${resolvedCity}/stops`);
                const stopsData = await adapter.handleStops(searchCtx) as AppStopCollection;
                const match = (stopsData?.features || []).find((f) =>
                    f.properties?.stop_name?.toLowerCase().includes(String(args.stop_name).toLowerCase())
                );
                if (match) {
                    stopId = match.properties?.stop_id;
                    stopNameResolved = match.properties?.stop_name;
                } else {
                    return { error: `No stop found matching '${args.stop_name}' in ${resolvedCity}.` };
                }
            }

            // 2. If stop_id & stop_name are missing but latitude & longitude are provided, find closest stop
            if (!stopId && args.latitude !== undefined && args.longitude !== undefined) {
                const lat = Number(args.latitude);
                const lon = Number(args.longitude);
                if (!isNaN(lat) && !isNaN(lon)) {
                    const searchCtx = createMockContext(ctx, resolvedCity, `/api/${resolvedCity}/stops`);
                    const stopsData = await adapter.handleStops(searchCtx) as AppStopCollection;
                    let minDistance = Infinity;
                    let closest = null;

                    for (const f of stopsData?.features || []) {
                        if (f.geometry?.coordinates) {
                            const [stopLon, stopLat] = f.geometry.coordinates;
                            const dist = calculateHaversineDistanceMeters(lat, lon, stopLat, stopLon);
                            if (dist < minDistance) {
                                minDistance = dist;
                                closest = f;
                            }
                        }
                    }
                    if (closest) {
                        stopId = closest.properties?.stop_id;
                        stopNameResolved = closest.properties?.stop_name;
                    }
                }
            }

            if (!stopId) {
                return { error: "Either 'stop_id', 'stop_name', or ('latitude' and 'longitude') must be provided." };
            }

            // Note: Api query parameter schema expects 'stopId', not 'ids'
            const searchParams: Record<string, string> = { stopId: stopId, limit: String(limit) };
            const mockCtx = createMockContext(ctx, resolvedCity, `/api/${resolvedCity}/departures`, searchParams);
            const departuresData = await adapter.handleDepartures(mockCtx) as AppDepartureResponse;

            let departures = departuresData?.departures || [];
            if (args.line) {
                const lineQuery = String(args.line).trim().toLowerCase();
                departures = departures.filter((d) => String(d.line).toLowerCase() === lineQuery);
            }

            if (args.route_type) {
                const rType = String(args.route_type);
                departures = departures.filter((d) => matchesRouteType(d.type, rType));
            }

            const matchingInfotexts = await getMatchingInfotexts(ctx, adapter, resolvedCity, stopId);

            return {
                city: resolvedCity,
                stop_id: stopId,
                stop_name: stopNameResolved,
                count: departures.slice(0, limit).length,
                infotexts: matchingInfotexts.map((i) => ({
                    id: i.id,
                    text: i.text,
                    text_en: i.textEn,
                    priority: i.priority
                })),
                departures: departures.slice(0, limit).map((d) => ({
                    line: d.line,
                    type: d.type,
                    headsign: d.headsign,
                    timestamp: d.timestamp,
                    scheduled: d.scheduled,
                    delay_seconds: d.delay ?? 0,
                    delay_minutes: Math.round((d.delay || 0) / 60 * 10) / 10,
                    is_wheelchair_accessible: d.is_wheelchair_accessible ?? null,
                    trip_id: d.tripId,
                    vehicle_id: d.vehicleId
                }))
            };
        }

        case "get_nearest_departures": {
            const lat = Number(args.latitude);
            const lon = Number(args.longitude);
            if (isNaN(lat) || isNaN(lon)) {
                return { error: "Valid 'latitude' and 'longitude' numeric coordinates are required." };
            }

            const radiusMeters = Number(args.radius_meters) || 500;
            const limit = Number(args.limit) || 10;
            const searchCtx = createMockContext(ctx, resolvedCity, `/api/${resolvedCity}/stops`);
            const stopsData = await adapter.handleStops(searchCtx) as AppStopCollection;

            const stopsWithDistance: Array<{ feature: AppStopCollection['features'][0]; distance: number }> = [];

            for (const f of stopsData?.features || []) {
                if (f.geometry?.coordinates) {
                    const [stopLon, stopLat] = f.geometry.coordinates;
                    const dist = calculateHaversineDistanceMeters(lat, lon, stopLat, stopLon);
                    stopsWithDistance.push({ feature: f, distance: dist });
                }
            }

            stopsWithDistance.sort((a, b) => a.distance - b.distance);

            let nearby = stopsWithDistance.filter((s) => s.distance <= radiusMeters);
            if (nearby.length === 0) {
                nearby = stopsWithDistance.slice(0, 3);
            } else {
                nearby = nearby.slice(0, 5);
            }

            const nearestStopsResult = [];

            for (const { feature, distance } of nearby) {
                const sId = feature.properties?.stop_id;
                const sName = feature.properties?.stop_name;
                if (!sId) continue;

                const searchParams: Record<string, string> = { stopId: sId, limit: String(limit) };
                const mockCtx = createMockContext(ctx, resolvedCity, `/api/${resolvedCity}/departures`, searchParams);

                try {
                    const departuresData = await adapter.handleDepartures(mockCtx) as AppDepartureResponse;
                    let departures = departuresData?.departures || [];

                    if (args.line) {
                        const lineQuery = String(args.line).trim().toLowerCase();
                        departures = departures.filter((d) => String(d.line).toLowerCase() === lineQuery);
                    }

                    if (args.route_type) {
                        const rType = String(args.route_type);
                        departures = departures.filter((d) => matchesRouteType(d.type, rType));
                    }

                    const stopInfotexts = await getMatchingInfotexts(ctx, adapter, resolvedCity, sId);

                    if (departures.length > 0 || stopInfotexts.length > 0) {
                        nearestStopsResult.push({
                            stop_id: sId,
                            stop_name: sName,
                            distance_meters: Math.round(distance),
                            infotexts: stopInfotexts.map((i) => ({
                                id: i.id,
                                text: i.text,
                                text_en: i.textEn,
                                priority: i.priority
                            })),
                            departures: departures.slice(0, limit).map((d) => ({
                                line: d.line,
                                type: d.type,
                                headsign: d.headsign,
                                timestamp: d.timestamp,
                                scheduled: d.scheduled,
                                delay_seconds: d.delay ?? 0,
                                delay_minutes: Math.round((d.delay || 0) / 60 * 10) / 10,
                                is_wheelchair_accessible: d.is_wheelchair_accessible ?? null,
                                trip_id: d.tripId,
                                vehicle_id: d.vehicleId
                            }))
                        });
                    }
                } catch {
                    // Skip stop if departure request fails
                }
            }

            return {
                city: resolvedCity,
                search_location: { latitude: lat, longitude: lon },
                radius_meters: radiusMeters,
                stops_count: nearestStopsResult.length,
                nearest_stops: nearestStopsResult
            };
        }

        case "get_realtime_vehicles": {
            const limit = Number(args.limit) || 25;
            const searchParams: Record<string, string> = {};

            if (args.line) {
                searchParams.routeShortName = String(args.line);
            } else {
                const cityConfig = getCityConfig(resolvedCity);
                if (cityConfig?.bounds) {
                    searchParams.bounds = cityConfig.bounds.join(',');
                }
            }

            const mockCtx = createMockContext(ctx, resolvedCity, `/api/${resolvedCity}/vehicles`, searchParams);
            const vehiclesData = await adapter.handleVehicles(mockCtx) as AppVehicleCollection;

            let vehicles = vehiclesData?.features || [];

            if (args.min_delay !== undefined) {
                const minDelay = Number(args.min_delay);
                vehicles = vehicles.filter((v) => {
                    const delaySec = v.properties?.delay ?? 0;
                    return (delaySec / 60) >= minDelay;
                });
            }

            return {
                city: resolvedCity,
                total_vehicles: vehicles.length,
                vehicles: vehicles.slice(0, limit).map((v) => {
                    const props = v.properties || {};
                    return {
                        vehicle_id: props.vehicle_id,
                        gtfs_trip_id: props.gtfs_trip_id,
                        line: props.route_short_name,
                        headsign: props.trip_headsign,
                        delay_seconds: props.delay ?? 0,
                        delay_minutes: Math.round((props.delay || 0) / 60 * 10) / 10,
                        coordinates: v.geometry?.coordinates || null
                    };
                })
            };
        }

        case "get_service_alerts": {
            const mockAlertsCtx = createMockContext(ctx, resolvedCity, `/api/${resolvedCity}/alerts`);
            const mockInfoCtx = createMockContext(ctx, resolvedCity, `/api/${resolvedCity}/infotexts`);

            const [alertsData, infotextsData] = await Promise.all([
                adapter.handleAlerts(mockAlertsCtx).catch(() => ({ alerts: [] })),
                adapter.handleInfotexts(mockInfoCtx).catch(() => [])
            ]) as [AppAlertsResponse, AppInfotext[]];

            let alerts = (alertsData?.alerts || []);
            if (args.line) {
                const lineQuery = String(args.line).trim().toLowerCase();
                alerts = alerts.filter((a) => {
                    const lines = a.lines || [];
                    return lines.some((l: string) => String(l).toLowerCase() === lineQuery);
                });
            }

            return {
                city: resolvedCity,
                alerts_count: alerts.length,
                alerts: alerts.map((a) => ({
                    title: a.title,
                    description: a.description,
                    affected_lines: a.lines || [],
                    valid_from: a.valid_from,
                    valid_to: a.valid_to,
                    link: a.link
                })),
                infotexts: infotextsData
            };
        }

        case "get_vehicle_detail": {
            const tripId = (args.trip_id as string) || (args.gtfs_trip_id as string);
            if (!tripId) {
                return { error: "Parameter 'trip_id' is required for vehicle detail." };
            }

            const searchParams: Record<string, string> = { tripId };
            if (args.vehicle_id) searchParams.vehicleId = String(args.vehicle_id);

            const mockCtx = createMockContext(ctx, resolvedCity, `/api/${resolvedCity}/vehicle-detail`, searchParams);
            const detailData = await adapter.handleVehicleDetail(mockCtx);

            return {
                city: resolvedCity,
                trip_id: tripId,
                detail: detailData
            };
        }

        default:
            throw new Error(`Unknown MCP tool '${name}'`);
    }
}

/**
 * Cloudflare Pages Function entrypoint for /mcp
 */
export const onRequest: PagesFunction<Env> = async (ctx) => {
    const { request } = ctx;

    // Handle preflight CORS requests
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Handle GET requests (SSE connection or health/info ping)
    if (request.method === "GET") {
        const accept = request.headers.get("accept") || "";

        // Server-Sent Events (SSE) Stream
        if (accept.includes("text/event-stream")) {
            const body = new ReadableStream({
                start(controller) {
                    const encoder = new TextEncoder();
                    controller.enqueue(encoder.encode("event: endpoint\ndata: /mcp\n\n"));
                }
            });

            return new Response(body, {
                headers: {
                    ...CORS_HEADERS,
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive"
                }
            });
        }

        // Standard GET health & server metadata
        return new Response(JSON.stringify({
            status: "ok",
            name: "departs-mcp",
            version: "1.0.0",
            description: "Remote Model Context Protocol (MCP) Server for real-time Czech public transit (Prague PID & Brno IDS JMK)",
            documentation: "https://departs.app",
            endpoint: "https://departs.app/mcp",
            tools_count: MCP_TOOLS.length
        }, null, 2), {
            headers: {
                ...CORS_HEADERS,
                "Content-Type": "application/json"
            }
        });
    }

    // Handle POST requests (MCP JSON-RPC 2.0 protocol)
    if (request.method === "POST") {
        try {
            const payload = await request.json() as JsonRpcRequest;
            const { jsonrpc, id, method, params } = payload || {};

            if (jsonrpc !== "2.0") {
                return new Response(JSON.stringify({
                    jsonrpc: "2.0",
                    id: id ?? null,
                    error: { code: -32600, message: "Invalid Request: jsonrpc must be '2.0'" }
                }), { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
            }

            // Method 1: initialize
            if (method === "initialize") {
                return new Response(JSON.stringify({
                    jsonrpc: "2.0",
                    id,
                    result: {
                        protocolVersion: "2024-11-05",
                        capabilities: {
                            tools: {}
                        },
                        authentication: {
                            type: "none"
                        },
                        serverInfo: {
                            name: "departs-mcp",
                            version: "1.0.0"
                        }
                    }
                }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
            }

            // Method 2: notifications/initialized
            if (method === "notifications/initialized") {
                return new Response(JSON.stringify({ jsonrpc: "2.0", result: {} }), {
                    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
                });
            }

            // Method 3: ping
            if (method === "ping") {
                return new Response(JSON.stringify({ jsonrpc: "2.0", id, result: {} }), {
                    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
                });
            }

            // Method 4: tools/list
            if (method === "tools/list") {
                return new Response(JSON.stringify({
                    jsonrpc: "2.0",
                    id,
                    result: {
                        tools: MCP_TOOLS
                    }
                }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
            }

            // Method 5: tools/call
            if (method === "tools/call") {
                const toolName = (params?.name as string) || "";
                const toolArgs = (params?.arguments as Record<string, unknown>) || {};
                try {
                    const resultData = await handleToolCall(toolName, toolArgs, ctx);
                    return new Response(JSON.stringify({
                        jsonrpc: "2.0",
                        id,
                        result: {
                            content: [
                                {
                                    type: "text",
                                    text: JSON.stringify(resultData, null, 2)
                                }
                            ]
                        }
                    }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
                } catch (toolErr: unknown) {
                    const errMsg = toolErr instanceof Error ? toolErr.message : String(toolErr);
                    return new Response(JSON.stringify({
                        jsonrpc: "2.0",
                        id,
                        result: {
                            isError: true,
                            content: [
                                {
                                    type: "text",
                                    text: `Tool Execution Error: ${errMsg}`
                                }
                            ]
                        }
                    }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
                }
            }

            // Unknown JSON-RPC method
            return new Response(JSON.stringify({
                jsonrpc: "2.0",
                id,
                error: { code: -32601, message: `Method not found: ${method}` }
            }), { status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });

        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            return new Response(JSON.stringify({
                jsonrpc: "2.0",
                id: null,
                error: { code: -32700, message: `Parse error: ${errMsg}` }
            }), { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
        }
    }

    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
};
