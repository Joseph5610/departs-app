import type { RouteType } from '../types/transit';

/** Display order of transport modes wherever they are listed or sorted. */
export const ROUTE_TYPE_ORDER: RouteType[] = ['metro', 'train', 'tram', 'trolleybus', 'bus', 'ferry', 'funicular'];

const ROUTE_TYPE_RANK = new Map<string, number>(ROUTE_TYPE_ORDER.map((type, i) => [type, i]));

/** Position of a mode in ROUTE_TYPE_ORDER; unknown modes sort last. */
export const routeTypeRank = (type: string | number | null | undefined): number =>
    ROUTE_TYPE_RANK.get(String(type ?? '')) ?? ROUTE_TYPE_ORDER.length;

/*
 * Delay definitions. Each screen deliberately uses its own window for "on time":
 * the map tiers, the stats distribution and the vehicle badges. Keep them here, side by side.
 */

/**
 * Map colouring and filtering bands, each up to `maxDelayS` inclusive. Vehicles without delay data
 * count as on time.
 */
export const DELAY_TIERS = [
    { key: 'aheadOfTime', maxDelayS: -60, color: '#38bdf8', includesUnknown: false },
    { key: 'onTime', maxDelayS: 120, color: '#4ade80', includesUnknown: true },
    { key: 'moderate', maxDelayS: 300, color: '#fbbf24', includesUnknown: false },
    { key: 'high', maxDelayS: 600, color: '#f87171', includesUnknown: false },
    { key: 'severe', maxDelayS: Infinity, color: '#6b21a8', includesUnknown: false },
] as const;

export type DelayTierKey = typeof DELAY_TIERS[number]['key'];

/** Thresholds for client-side city stats; keep in step with the backend aggregator behind /stats. */
export const STATS_AGGREGATION = {
    /** Delays beyond this in either direction are treated as ghost vehicles and ignored. */
    MAX_PLAUSIBLE_DELAY_S: 7200,
    ON_TIME_MAX_DELAY_S: 60,
    DELAYED_THRESHOLD_S: 300,
    MOST_DELAYED_LIMIT: 20,
    /** Most-delayed rows shown before the card offers to expand. */
    MOST_DELAYED_PREVIEW: 5,
    BUSIEST_LINES_LIMIT: 5,
    /** Placeholder for a missing vehicle or trip ID in most_delayed entries, also sent by /stats. */
    MISSING_ID: 'N/A',
};

/** Vehicle badges and stop times read as late or early only beyond this many seconds. */
const DELAY_BADGE_TOLERANCE_S = 30;

export type DelayStatus = 'late' | 'early' | 'onTime';

export const getDelayStatus = (delaySec: number): DelayStatus =>
    delaySec > DELAY_BADGE_TOLERANCE_S ? 'late' : delaySec < -DELAY_BADGE_TOLERANCE_S ? 'early' : 'onTime';
