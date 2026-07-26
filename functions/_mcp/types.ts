import type { EventContext } from "@cloudflare/workers-types";
import type { Env } from "../_core/types";

export type McpContext = EventContext<Env, string, unknown>;

export interface JsonRpcRequest {
    jsonrpc: string;
    id?: string | number | null;
    method: string;
    params?: Record<string, unknown>;
}

export interface McpToolProperty {
    type: string;
    enum?: string[];
    description: string;
}

export interface McpToolInputSchema {
    type: "object";
    properties: Record<string, McpToolProperty>;
    required?: string[];
}

export interface McpToolDefinition {
    name: string;
    description: string;
    inputSchema: McpToolInputSchema;
}
