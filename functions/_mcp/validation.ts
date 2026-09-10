import { z } from 'zod';
import { MCP_TOOLS } from './tools';
import type { McpToolInputSchema } from './types';

/**
 * Runtime validation for MCP tool arguments.
 *
 * Tool arguments are the least trusted input this Worker accepts: arbitrary JSON-RPC from any caller on
 * the open internet, previously reaching handlers as raw `args.limit as number` casts.
 *
 * The validators are derived from each tool's own declared `inputSchema` rather than hand-written
 * alongside it, so the schema advertised over `tools/list` and the schema actually enforced cannot drift
 * apart. `McpToolInputSchema` only ever carries `string` and `number` properties plus an optional enum
 * and required list, which is why the conversion below can stay this small.
 */

/**
 * Domain constraints the JSON Schema cannot express. Each is a fact about the value, not a policy:
 * a latitude outside ±90 is not a latitude, and a `limit` of -5 silently means "drop the last five"
 * once it reaches `Array.prototype.slice`.
 */
const NUMERIC_CONSTRAINTS: Record<string, (schema: z.ZodNumber) => z.ZodNumber> = {
    latitude: (schema) => schema.min(-90).max(90),
    longitude: (schema) => schema.min(-180).max(180),
    limit: (schema) => schema.int().min(1).max(200),
    radius_meters: (schema) => schema.min(1).max(50_000),
};

function propertyToZod(name: string, property: { type: string; enum?: string[] }): z.ZodTypeAny {
    if (property.enum && property.enum.length > 0) {
        return z.enum(property.enum as [string, ...string[]]);
    }

    if (property.type === 'number') {
        // `.finite()` is the point: NaN and Infinity are numbers as far as JSON and JS are concerned,
        // and both survive every comparison downstream without ever matching anything.
        const base = z.number().finite();
        const constrain = NUMERIC_CONSTRAINTS[name];
        return constrain ? constrain(base) : base;
    }

    return z.string();
}

function buildSchema(input: McpToolInputSchema): z.ZodTypeAny {
    const required = new Set(input.required ?? []);
    const shape: Record<string, z.ZodTypeAny> = {};

    for (const [name, property] of Object.entries(input.properties)) {
        const field = propertyToZod(name, property);
        shape[name] = required.has(name) ? field : field.optional();
    }

    // Unknown keys are stripped rather than rejected: MCP clients are free to send extra fields, and
    // failing the call over one would be hostile for no security benefit.
    return z.object(shape);
}

/** Built once per isolate — there are seven tools and their schemas are static. */
const schemasByTool = new Map<string, z.ZodTypeAny>(
    MCP_TOOLS.map(tool => [tool.name, buildSchema(tool.inputSchema)])
);

/**
 * Validates raw tool arguments against the tool's declared input schema.
 *
 * @throws Error with a caller-readable message when the arguments do not match. The RPC layer surfaces
 *         this as an `isError` tool result, which is how MCP reports a failed call.
 */
/**
 * Argument aliases accepted but not advertised.
 *
 * `get_vehicle_detail` has always fallen back to `gtfs_trip_id` when `trip_id` was absent, even though
 * only `trip_id` appears in its declared schema. Validation strips undeclared keys, so the alias is
 * folded in here rather than silently dropped — and rather than advertising a second name for one field.
 */
const ARGUMENT_ALIASES: Record<string, Record<string, string>> = {
    get_vehicle_detail: { gtfs_trip_id: 'trip_id' },
};

function applyAliases(toolName: string, args: Record<string, unknown>): Record<string, unknown> {
    const aliases = ARGUMENT_ALIASES[toolName];
    if (!aliases) return args;

    const resolved = { ...args };
    for (const [alias, canonical] of Object.entries(aliases)) {
        if (resolved[canonical] === undefined && resolved[alias] !== undefined) {
            resolved[canonical] = resolved[alias];
        }
    }
    return resolved;
}

export function validateToolArgs(toolName: string, args: Record<string, unknown>): Record<string, unknown> {
    const schema = schemasByTool.get(toolName);
    if (!schema) {
        throw new Error(`Unknown MCP tool '${toolName}'`);
    }

    const parsed = schema.safeParse(applyAliases(toolName, args));
    if (!parsed.success) {
        const detail = parsed.error.issues
            .map(issue => `${issue.path.join('.') || 'arguments'}: ${issue.message}`)
            .join('; ');
        throw new Error(`Invalid arguments for '${toolName}' — ${detail}`);
    }

    return parsed.data as Record<string, unknown>;
}
