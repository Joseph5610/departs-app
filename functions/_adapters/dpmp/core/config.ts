/**
 * Configuration for the Prešov (DPMP) adapter: GTFS static data plus a realtime CSV export.
 */
export const DPMP_CONFIG = {
    /** The CSV is served as raw bytes in the Windows Central European code page. */
    CSV_ENCODING: 'windows-1250',
    CSV_DELIMITER: ';',
    /** Edge cache hint for the CSV; upstream refreshes it roughly every 15s. */
    CSV_CACHE_TTL_S: 10,

    /**
     * Local dev only: the upstream offers only legacy TLS ciphers that local workerd rejects, so
     * requests served from these hosts fetch the CSV via the Vite dev-server relay at this path.
     */
    DEV_RELAY_PATH: '/__dev/dpmp.csv',
    DEV_HOSTNAMES: ['localhost', '127.0.0.1'] as readonly string[],

    /**
     * How long a vehicle missing from the CSV keeps its last report. The export routinely drops
     * vehicles for one to six 15s snapshots; without this the map and detail flicker to fallback.
     */
    DROPOUT_GRACE_MS: 120_000,

    /** CSV `DIRECTION` to GTFS `direction_id`. D/Z/R (depot and positioning runs) have no GTFS trip. */
    DIRECTION_IDS: { T: 0, P: 1 } as Record<string, number>,

    /** How far ahead of its planned start a vehicle may already report on a trip. */
    MAX_EARLY_START_MINS: 60,
    /** How long after its planned start a trip may still be running. */
    MAX_TRIP_AGE_MINS: 720,

    /** Operator shown on vehicle detail; every vehicle in the CSV belongs to DPMP. */
    OPERATOR: 'DPMP',

    /** Route type assumed for vehicles whose line is missing from routes.json. */
    FALLBACK_ROUTE_TYPE: '3',

    /** Minimum movement before a new bearing is derived from consecutive positions. */
    BEARING_MIN_MOVE_M: 15,
    BEARING_CACHE_MAX_ENTRIES: 512,
} as const;
