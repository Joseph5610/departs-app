import type { CityFacts } from '../../shared/cities';

interface FeedConfig {
    realtimeUrl?: string;
    hasTripAliases?: boolean;
    [key: string]: string | boolean | undefined;
}

/** A city as the server runs it: its shared facts plus how its feeds are read. */
export interface CityConfig extends CityFacts {
    feed?: FeedConfig;
    /** Operator shown on a vehicle detail whose own operator is unknown (a timetable-only detail, a feed naming none). */
    networkOperator?: string;
}
