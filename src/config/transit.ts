import type { RouteType } from '@/types';

/** Display order of transport modes wherever they are listed or sorted. */
export const ROUTE_TYPE_ORDER: RouteType[] = ['metro', 'train', 'tram', 'trolleybus', 'bus', 'ferry', 'funicular'];

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

/** Thresholds for the city stats the app computes from the vehicle list. */
export const STATS_AGGREGATION = {
    /** Delays beyond this in either direction are treated as ghost vehicles and ignored. */
    MAX_PLAUSIBLE_DELAY_S: 7200,
    ON_TIME_MAX_DELAY_S: 60,
    DELAYED_THRESHOLD_S: 300,
    MOST_DELAYED_LIMIT: 20,
    /** Most-delayed rows shown before the card offers to expand. */
    MOST_DELAYED_PREVIEW: 5,
    BUSIEST_LINES_LIMIT: 5,
    /** Placeholder for a missing vehicle or trip ID in most_delayed entries. */
    MISSING_ID: 'N/A',
};

/** Vehicle badges and stop times read as late or early only beyond this many seconds. */
export const DELAY_BADGE_TOLERANCE_S = 30;
