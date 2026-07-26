import type { PagesFunction } from "@cloudflare/workers-types";
import type { Env } from "../_core/types";
import type { JsonRpcRequest } from "./types";
import { MCP_TOOLS } from "./tools";
import { CORS_HEADERS } from "./utils";
import { handleToolCall } from "./handlers";

/**
 * Cloudflare Pages Function handler for /mcp
 */
export const handleMcpRequest: PagesFunction<Env> = async (ctx) => {
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
