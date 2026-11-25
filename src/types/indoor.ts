import type { Geometry } from 'geojson';

/** What an indoor map feature is; mirrors `IndoorKind` in departs-data's contract. */
export type IndoorKind =
    | 'area' | 'room' | 'corridor' | 'wall' | 'platform' | 'footway' | 'steps' | 'escalator'
    | 'elevator' | 'entrance' | 'shop' | 'toilets' | 'tickets';

export interface IndoorProperties {
    k: IndoorKind;
    /** Whole floors the feature is on, ascending. */
    lv: number[];
    name?: string;
    ref?: string;
}

export interface IndoorFeature {
    type: 'Feature';
    geometry: Geometry;
    properties: IndoorProperties;
}

/** `indoor/<station>.json` on the static data CDN: one station's floor plan. */
export interface IndoorPlan {
    type: 'FeatureCollection';
    features: IndoorFeature[];
}

export interface IndoorStation {
    name: string;
    /** Every floor of the plan, ascending. */
    levels: number[];
    /** `[west, south, east, north]` of the plan. */
    bbox: [number, number, number, number];
    /** A hash of the plan file; it goes into the file's URL so a CDN never serves an older copy. */
    v: string;
}

/** `indoor/index.json`: the metro and rail stations that have a floor plan, by id. */
export interface IndoorIndex {
    version: 4;
    stations: Record<string, IndoorStation>;
}

/** `platforms/index.json`: a hash of each city's street-level platforms file. */
export interface PlatformsIndex {
    version: 1;
    cities: Record<string, { v: string }>;
}
