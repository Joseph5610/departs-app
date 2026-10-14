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
    /** The app's own estimate rather than a message from the network's stream. */
    isEstimate?: boolean;
}

type EnrichmentNormalizer<T = unknown> = (rawMsg: T) => EnrichmentPatch | null;

export interface EnrichmentChannelAdapter<T = unknown> {
    /** WebSocket URL (`wss://`) to subscribe to */
    url: string;
    /** Parses a raw WebSocket message into our internal patch shape */
    normalize: EnrichmentNormalizer<T>;
    /** Optional JSON payload to send upon WebSocket connection (e.g. for ArcGIS StreamServer filtering) */
    wsFilterPayload?: Record<string, unknown>;
    /** Kept configured but not connected; the app's own delay estimate stands in. */
    isDisabled?: boolean;
}
