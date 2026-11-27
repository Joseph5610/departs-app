import type { ExpressionSpecification } from 'maplibre-gl';
import type { RouteType } from '@/types';
import { MAP_ICONS, STOP_GLOW } from '@/config/mapLayers';
import { mixHex } from '@/lib/color';
import { ROUTE_TYPE_ORDER } from '@/config/transit';
import { FRONTEND_CITIES_CONFIG } from '@/config/cities';
import { modeColorsOf } from './stopBadges';

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

/** The networks a station may belong to; a station of the selected network carries no `city_slug` and counts as `OWN`. */
const OWN = 'own';
const NETWORKS = [OWN, ...Object.keys(FRONTEND_CITIES_CONFIG)];
const stationNetwork: ExpressionSpecification = ['coalesce', ['get', 'city_slug'], OWN];

const networkCount = (network: string) => `net_${network}`;
const clusterModeCount = (network: string, mode: RouteType) => `modes_${network}_${mode}`;
const isOf = (network: string, rank: number): ExpressionSpecification =>
    ['all', ['==', stationNetwork, network], ['==', ['coalesce', ['get', 'mode_rank'], -1], rank]];

/** Each cluster counts its stations by network, and by leading mode within each, so it can take the colour of the network and mode most of them share. */
export const STATION_CLUSTER_PROPERTIES = Object.fromEntries(NETWORKS.flatMap(network => [
    [networkCount(network), ['+', ['case', ['==', stationNetwork, network], 1, 0]]],
    ...ROUTE_TYPE_ORDER.map((mode, rank) => [clusterModeCount(network, mode), ['+', ['case', isOf(network, rank), 1, 0]]]),
]));

/** The colour of the mode most of a network's stations in the cluster lead with (the earlier mode on a tie); `unknown` when none leads with a mode. */
const clusterModeColor = (network: string, colors: Record<RouteType, string>): ExpressionSpecification => {
    const count = (mode: RouteType): ExpressionSpecification => ['get', clusterModeCount(network, mode)];
    const wins = ROUTE_TYPE_ORDER.flatMap(mode => [
        ['all', ['>', count(mode), 0], ...ROUTE_TYPE_ORDER.filter(other => other !== mode).map(other => ['>=', count(mode), count(other)])],
        colors[mode],
    ]);
    return ['case', ...wins, colors.unknown] as ExpressionSpecification;
};

/** A cluster's colour: in the colours of the network most of its stations belong to (the selected one on a tie), of its leading mode there. */
const clusterColor = (colorsOf: (network: string) => Record<RouteType, string>): ExpressionSpecification => {
    const count = (network: string): ExpressionSpecification => ['get', networkCount(network)];
    const wins = NETWORKS.slice(1).flatMap(network => [
        ['all', ...NETWORKS.filter(other => other !== network).map(other => ['>', count(network), count(other)])],
        clusterModeColor(network, colorsOf(network)),
    ]);
    return ['case', ...wins, clusterModeColor(OWN, colorsOf(OWN))] as ExpressionSpecification;
};

/** A lone station's colour, by its leading mode in its network's colours. */
const stationColor = (colorsOf: (network: string) => Record<RouteType, string>): ExpressionSpecification => {
    const byMode = (colors: Record<RouteType, string>): ExpressionSpecification => ['case',
        ...ROUTE_TYPE_ORDER.flatMap((mode, rank) => [['==', ['coalesce', ['get', 'mode_rank'], -1], rank], colors[mode]]),
        colors.unknown] as ExpressionSpecification;
    return ['match', stationNetwork, ...NETWORKS.slice(1).flatMap(network => [network, byMode(colorsOf(network))]), byMode(colorsOf(OWN))] as ExpressionSpecification;
};

/** A stop glow's colour, muted for `theme`, in the mode colours of the stop's own network (`selectedCity` for its own stops): a cluster's by the network and mode most of its stations share. */
export const stopGlowColor = (selectedCity: string, theme: 'dark' | 'light'): ExpressionSpecification => {
    const { mix, target } = STOP_GLOW.muted;
    const colorsOf = (network: string) => Object.fromEntries(Object.entries(modeColorsOf(network === OWN ? selectedCity : network))
        .map(([mode, color]) => [mode, mixHex(color, target[theme], mix[theme])])) as Record<RouteType, string>;
    return ['case', ['has', 'point_count'], clusterColor(colorsOf), stationColor(colorsOf)] as ExpressionSpecification;
};
