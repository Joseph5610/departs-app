import type { McpToolDefinition } from "./types";
import { CITY_REGISTRY } from "../_core/city-config";
import { MCP_DEFAULTS } from "../_core/config";

const CITY_SLUGS = Object.keys(CITY_REGISTRY);

/**
 * Tool definitions exposed to Model Context Protocol (MCP) clients.
 */
export const MCP_TOOLS: McpToolDefinition[] = [
    {
        name: "search_stops",
        description: "Search public transit stops/stations by name or query string in Prague (PID), Brno (IDS JMK) or Prešov (DPMP).",
        inputSchema: {
            type: "object",
            properties: {
                city: {
                    type: "string",
                    enum: CITY_SLUGS,
                    description: `City transit system (default: '${MCP_DEFAULTS.CITY}').`
                },
                query: {
                    type: "string",
                    description: "Stop name or keyword (e.g. 'Čakovice', 'Hlavní nádraží', 'Svoboďák')."
                },
                limit: {
                    type: "number",
                    description: `Maximum number of search results to return (default: ${MCP_DEFAULTS.RESULT_LIMIT}).`
                }
            },
            required: ["query"]
        }
    },
    {
        name: "get_next_departures",
        description: "Get real-time upcoming public transit departures from a SPECIFIC stop name or stop ID in Prague (PID), Brno (IDS JMK) or Prešov (DPMP). Use when the user specifies a stop name (e.g., 'Hlavní nádraží', 'Sídliště Čakovice') or stop ID. Includes inline stop notice Banners/Infotexts.",
        inputSchema: {
            type: "object",
            properties: {
                city: {
                    type: "string",
                    enum: CITY_SLUGS,
                    description: `City transit system (default: '${MCP_DEFAULTS.CITY}').`
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
                    description: `Max number of departures to retrieve (default: ${MCP_DEFAULTS.RESULT_LIMIT}).`
                }
            }
        }
    },
    {
        name: "get_nearest_departures",
        description: "Get real-time upcoming departures for stops closest to a GEOGRAPHIC LOCATION (latitude and longitude) in Prague (PID), Brno (IDS JMK) or Prešov (DPMP). Use for proximity queries like: 'What departures are near me?', 'Will I catch the bus at 50.087, 14.421?', 'Any trams nearby?', 'Show closest departures to my location'. Can filter by route_type ('bus', 'tram', 'metro', 'train') or line number.",
        inputSchema: {
            type: "object",
            properties: {
                city: {
                    type: "string",
                    enum: CITY_SLUGS,
                    description: `City transit system (default: '${MCP_DEFAULTS.CITY}').`
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
                    description: `Search radius in meters around coordinates (default: ${MCP_DEFAULTS.NEAREST_DEPARTURES_RADIUS_M}).`
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
                    description: `Max number of departures per stop (default: ${MCP_DEFAULTS.RESULT_LIMIT}).`
                }
            },
            required: ["latitude", "longitude"]
        }
    },
    {
        name: "search_nearest_stops",
        description: "Find public transit stops/stations closest to a geographic location (latitude and longitude) in Prague (PID), Brno (IDS JMK) or Prešov (DPMP). Returns nearest stops with distance_meters, coordinates, and serving transit lines.",
        inputSchema: {
            type: "object",
            properties: {
                city: {
                    type: "string",
                    enum: CITY_SLUGS,
                    description: `City transit system (default: '${MCP_DEFAULTS.CITY}').`
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
                    description: `Search radius in meters around coordinates (default: ${MCP_DEFAULTS.NEAREST_STOPS_RADIUS_M}).`
                },
                limit: {
                    type: "number",
                    description: `Max number of nearest stops to return (default: ${MCP_DEFAULTS.RESULT_LIMIT}).`
                }
            },
            required: ["latitude", "longitude"]
        }
    },
    {
        name: "get_realtime_vehicles",
        description: "Get live vehicle positions, current delays, vehicle numbers, and status in Prague, Brno or Prešov.",
        inputSchema: {
            type: "object",
            properties: {
                city: {
                    type: "string",
                    enum: CITY_SLUGS,
                    description: `City transit system (default: '${MCP_DEFAULTS.CITY}').`
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
                    description: `Maximum number of live vehicles to return (default: ${MCP_DEFAULTS.VEHICLES_LIMIT}).`
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
                    enum: CITY_SLUGS,
                    description: `City transit system (default: '${MCP_DEFAULTS.CITY}').`
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
                    enum: CITY_SLUGS,
                    description: `City transit system (default: '${MCP_DEFAULTS.CITY}').`
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
