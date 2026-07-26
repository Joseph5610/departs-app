import type { PagesFunction } from "@cloudflare/workers-types";
import type { Env } from "./_core/types";
import { handleMcpRequest } from "./_mcp/rpc";

/**
 * Cloudflare Pages Function entrypoint for /mcp endpoint.
 */
export const onRequest: PagesFunction<Env> = async (ctx) => {
    return handleMcpRequest(ctx);
};
