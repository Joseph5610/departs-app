import { useMemo } from 'react';
import type { FeatureCollection } from 'geojson';
import { useIndoorIndex } from '@/hooks/data/useIndoorIndex';
import { useIndoorPlan } from '@/hooks/data/useIndoorPlan';
import { useViewportStore } from '@/state/viewportStore';
import { activeIndoorStation, shownIndoorLevel, toIndoorMap } from '@/domain/indoor';
import type { Box } from '@/domain/cities';
import { memoizeLast } from '@/lib/memoize';
import { EMPTY_FEATURE_COLLECTION } from '@/lib/geojson';
import { INDOOR_MAP } from '@/config/constants';

const NO_LEVELS: readonly number[] = [];

const mapOf = memoizeLast(toIndoorMap);

export interface IndoorMap {
    /** The station whose plan is shown; null without a plan on screen. */
    station: string | null;
    data: FeatureCollection;
    /** The station's floors, ascending. */
    levels: readonly number[];
    level: number;
}

/** The floor plan of the station nearest the middle of the map, and the floor shown; nothing while `view` is null (zoomed out). */
export const useIndoorMap = (view: Box | null): IndoorMap => {
    const pick = useViewportStore(s => s.indoorFloor);
    const { data: index } = useIndoorIndex(view !== null);
    const station = view && index ? activeIndoorStation(index, view) : null;
    const summary = station && index ? index.stations[station] : undefined;
    const { data: plan } = useIndoorPlan(station, summary?.v);

    const levels = summary?.levels ?? NO_LEVELS;
    const level = station ? shownIndoorLevel(levels, station, pick, INDOOR_MAP.DEFAULT_LEVEL) : INDOOR_MAP.DEFAULT_LEVEL;
    const data = station && plan ? mapOf(plan) : EMPTY_FEATURE_COLLECTION;
    return useMemo(() => ({ station, data, levels, level }), [station, data, levels, level]);
};
