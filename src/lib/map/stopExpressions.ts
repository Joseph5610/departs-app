import type { ExpressionSpecification } from 'maplibre-gl';
import type { RouteType } from '@/types';
import { MAP_ICONS, STOP_GLOW } from '@/config/mapLayers';
import { mixHex } from '@/lib/color';
import { ROUTE_TYPE_ORDER } from '@/config/transit';

/** A stop's city: its own `city_slug` for a neighbouring network's stop, else the selected city. */
const stopCity = (selectedCity: string): ExpressionSpecification => ['coalesce', ['get', 'city_slug'], selectedCity];

const isStarred = (starredIds: readonly string[]): ExpressionSpecification => ['in', ['get', 'stop_id'], ['literal', starredIds]];

/** The badge image of a stop, in its city's mode colours, starred when its id is in `starredIds`. */
export const stopBadgeImage = (selectedCity: string, starredIds: readonly string[] = []): ExpressionSpecification =>
    ['concat', MAP_ICONS.STOP_BADGE_PREFIX, stopCity(selectedCity), ':',
        ['case', isStarred(starredIds), '*', ''], ':',
        ['coalesce', ['get', 'platform_code'], ''], ':',
        ['coalesce', ['get', 'badges'], '']];

/** Draw order of overlapping platform badges: by leading mode, a starred one on top so its star stays visible. */
export const platformSortKey = (starredIds: readonly string[]): ExpressionSpecification =>
    ['+', ['coalesce', ['get', 'mode_rank'], 99], ['case', isStarred(starredIds), 1000, 0]];

const clusterModeCount = (mode: RouteType) => `modes_${mode}`;

/** Each cluster counts its stations by leading mode, so it can take the colour most of them share. */
export const STATION_CLUSTER_PROPERTIES = Object.fromEntries(ROUTE_TYPE_ORDER.map((mode, rank) =>
    [clusterModeCount(mode), ['+', ['case', ['==', ['coalesce', ['get', 'mode_rank'], -1], rank], 1, 0]]]));

/** A cluster's colour: that of the mode most of its stations lead with (the earlier mode on a tie), in the city's mode colours; `unknown` when none leads with a mode. */
export const clusterModeColor = (colors: Record<RouteType, string>): ExpressionSpecification => {
    const count = (mode: RouteType): ExpressionSpecification => ['get', clusterModeCount(mode)];
    const wins = ROUTE_TYPE_ORDER.flatMap(mode => [
        ['all', ['>', count(mode), 0], ...ROUTE_TYPE_ORDER.filter(other => other !== mode).map(other => ['>=', count(mode), count(other)])],
        colors[mode],
    ]);
    return ['case', ...wins, colors.unknown] as ExpressionSpecification;
};

/** A stop glow's colour, muted for `theme`: a cluster's by its leading mode, a lone station's by its own. */
export const stopGlowColor = (modeColors: Record<RouteType, string>, theme: 'dark' | 'light'): ExpressionSpecification => {
    const { mix, target } = STOP_GLOW.muted;
    const colors = Object.fromEntries(Object.entries(modeColors).map(([mode, color]) => [mode, mixHex(color, target[theme], mix[theme])])) as Record<RouteType, string>;
    const ownMode = ROUTE_TYPE_ORDER.flatMap((mode, rank) => [['==', ['coalesce', ['get', 'mode_rank'], -1], rank], colors[mode]]);
    return ['case', ['has', 'point_count'], clusterModeColor(colors), ...ownMode, colors.unknown] as ExpressionSpecification;
};
