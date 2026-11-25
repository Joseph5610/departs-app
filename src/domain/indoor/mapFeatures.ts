import type { Feature, FeatureCollection } from 'geojson';
import type { IndoorPlan } from '@/types';
import { INDOOR_LEVELS_PROPERTY } from '@/config/mapLayers';

/** The marker a feature on `level` carries in `INDOOR_LEVELS_PROPERTY`. */
export const indoorLevelToken = (level: number | string): string => `;${level};`;

/** A plan's features for the map, each tagged with its floors as tokens, since the map stringifies array properties. */
export const toIndoorMap = (plan: IndoorPlan): FeatureCollection => ({
    type: 'FeatureCollection',
    features: plan.features.map((feature): Feature => ({
        type: 'Feature',
        geometry: feature.geometry,
        properties: { ...feature.properties, [INDOOR_LEVELS_PROPERTY]: indoorLevelToken(feature.properties.lv.join(';')) },
    })),
});
