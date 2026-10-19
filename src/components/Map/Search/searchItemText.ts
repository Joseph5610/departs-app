import type { TFunction } from 'i18next';
import type { LineBadgeData } from '@/domain/routes';
import type { PosSearchResult } from '@/domain/pointsOfSale';
import type { SearchHistoryItem, Stop, VehicleFeature } from '@/types';

/** The name a recent search is listed under. */
export const historyItemTitle = (item: SearchHistoryItem, t: TFunction): string =>
    item.type === 'stop' ? item.stop_name :
    item.type === 'place' || item.type === 'pos' ? item.name :
    t('search.lineFilter', { line: item.lines.join(', '), count: item.lines.length });

/** The second line under a recent search: a stop's platform or a place's address. */
export const historyItemSubtitle = (item: SearchHistoryItem, t: TFunction): string | undefined =>
    item.type === 'stop' && item.platform_code ? t('search.platform', { code: item.platform_code }) :
    item.type === 'place' || item.type === 'pos' ? item.subtitle :
    undefined;

/** The second line under a stop result: its platform, when it has one. */
export const stopResultSubtitle = (stop: Stop, t: TFunction): string | undefined =>
    stop.kind === 'platform' && stop.code ? t('search.platform', { code: stop.code }) : undefined;

/** The second line under a point of sale: its kind and address. */
export const posResultSubtitle = ({ pos }: PosSearchResult, t: TFunction): string =>
    [t(`pos.types.${pos.type}`, pos.type), pos.address].filter(Boolean).join(' · ');

/** The badge of the line a vehicle result is running. */
export const vehicleResultLines = ({ properties: p }: VehicleFeature): LineBadgeData[] =>
    [{ name: String(p.route_short_name), type: p.route_type, route_color: p.route_color }];
