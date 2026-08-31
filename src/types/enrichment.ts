/**
 * Fields that a push channel can supplement (all nullable base fields)
 */
export interface EnrichmentPatch {
    // Matcher keys (at least one required)
    tripId?: string;
    vehicleId?: string;

    // Timestamp from the WS message itself (used for Gate 1 freshness check)
    dataTimestamp: number; // Unix ms

    // Supplementable fields (must match existing nullable fields in Departure / VehicleDetail)
    delay?: number | null;
    is_wheelchair_accessible?: boolean | null;
    is_air_conditioned?: boolean | null;
    run_number?: string | number | null;
}

/** Internal stored patch — adds client-received timestamp for Gate 2 silence TTL */
export interface StoredEnrichmentPatch extends EnrichmentPatch {
    receivedAt: number; // Date.now() when the client received the message
}

export type EnrichmentNormalizer<T = unknown> = (rawMsg: T) => EnrichmentPatch | null;

export interface EnrichmentChannelAdapter<T = unknown> {
    /** URL to connect to (WS ws://, SSE https://, or arbitrary) */
    url: string;
    /** Transport type — determines how useEnrichmentChannel connects */
    transport: 'websocket' | 'sse' | 'polling';
    /** Polling interval in ms (only for transport: 'polling') */
    pollIntervalMs?: number;
    /** Parses a raw message from the transport into our internal patch shape */
    normalize: EnrichmentNormalizer<T>;
    /** Optional JSON payload to send upon WebSocket connection (e.g. for ArcGIS StreamServer filtering) */
    wsFilterPayload?: Record<string, unknown>;
}
