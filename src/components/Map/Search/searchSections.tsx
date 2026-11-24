import type React from 'react';
import type { TFunction } from 'i18next';
import { Building2, BusFront, Search as SearchIcon, Star, Ticket } from 'lucide-react';
import { searchHistoryKey } from '@/lib/searchHistory';
import { vehicleDisplayNumber } from '@/domain/vehicles';
import type { LineBadgeData } from '@/domain/routes';
import type { ShownHistoryItem, Stop } from '@/types';
import type { useSearch } from '@/hooks/features/useSearch';
import { StopModeIcon } from '@/components/StopModeIcon';
import { HistoryItemIcon } from './HistoryItemIcon';
import { historyItemSubtitle, historyItemTitle, posResultSubtitle, stopResultSubtitle, vehicleResultLines } from './searchItemText';

/** One result, the same on the desktop dropdown and the phone's list. */
export interface SearchRow {
    key: string;
    icon: React.ReactNode;
    title?: string;
    subtitle?: string;
    lines?: LineBadgeData[];
    /** The stop a row opens, for a phone row's walking distance. */
    stop?: Stop;
    /** The line filter suggestion, drawn as the row to act on. */
    isPrimary?: boolean;
    testId: string;
    onSelect: () => void;
}

export interface SearchSection {
    id: 'recent' | 'favorites' | 'lines' | 'stops' | 'vehicles' | 'places' | 'pos';
    title: string;
    count?: number;
    rows: SearchRow[];
}

interface SearchSectionsInput {
    search: ReturnType<typeof useSearch>;
    /** The stops the box lists: the pinned ones before typing, the matches after. */
    stops: readonly Stop[];
    /** The desktop box hides recent searches while a line filter fills it. */
    hidesHistory?: boolean;
    t: TFunction;
    historyLines: (item: ShownHistoryItem) => LineBadgeData[] | undefined;
}

/** The result groups in their order: recent searches and favourites before typing, then lines, stops, vehicles, places and points of sale. */
export const searchSections = ({ search: s, stops, hidesHistory = false, t, historyLines }: SearchSectionsInput): SearchSection[] => {
    const isEmptyQuery = s.query === '';
    const stopRow = (prefix: 'fav' | 'res') => (stop: Stop): SearchRow => ({
        key: stop.id,
        icon: s.pinnedStopIds.has(stop.id)
            ? <Star size={20} fill="currentColor" strokeWidth={1.5} className="text-favorite" />
            : <StopModeIcon lines={stop.lines} size={20} />,
        title: stop.name,
        subtitle: stopResultSubtitle(stop, t),
        lines: stop.lines,
        stop,
        testId: `search-item-${prefix}-stop-${stop.id}`,
        onSelect: () => s.selectStop(stop),
    });

    const sections: SearchSection[] = [];
    if (isEmptyQuery && !hidesHistory && s.searchHistory.length > 0) sections.push({
        id: 'recent', title: t('search.recent'), count: s.searchHistory.length,
        rows: s.searchHistory.map(item => ({
            key: searchHistoryKey(item),
            icon: <HistoryItemIcon type={item.type} />,
            title: historyItemTitle(item),
            subtitle: historyItemSubtitle(item, t),
            lines: historyLines(item),
            testId: `search-item-hist-${searchHistoryKey(item)}`,
            onSelect: () => s.selectHistory(item),
        })),
    });
    if (isEmptyQuery && stops.length > 0) sections.push({ id: 'favorites', title: t('search.favorites'), count: stops.length, rows: stops.map(stopRow('fav')) });
    const queryLines = s.queryLines;
    if (queryLines) sections.push({
        id: 'lines', title: t('search.lines'),
        rows: [{
            key: queryLines.join('-'),
            icon: <SearchIcon size={20} strokeWidth={1.5} />,
            title: t('search.filterByLine'),
            lines: s.queryLineBadges ?? undefined,
            isPrimary: true,
            testId: `search-item-line-${queryLines.join('-')}`,
            onSelect: () => s.selectLine(queryLines),
        }],
    });
    if (!isEmptyQuery && stops.length > 0) sections.push({ id: 'stops', title: t('search.stops'), rows: stops.map(stopRow('res')) });
    if (s.vehicleResults.length > 0) sections.push({
        id: 'vehicles', title: t('search.vehicles'),
        rows: s.vehicleResults.map(vehicle => {
            const vehicleId = vehicle.properties.vehicle_id ?? '';
            return {
                key: vehicleId,
                icon: <BusFront size={20} strokeWidth={1.5} />,
                title: t('search.vehicleNumber', { number: vehicleDisplayNumber(vehicleId) }),
                subtitle: vehicle.properties.trip_headsign,
                lines: vehicleResultLines(vehicle),
                testId: `search-item-vehicle-${vehicleId}`,
                onSelect: () => s.selectVehicle(vehicle),
            };
        }),
    });
    if (s.geocodingResults.length > 0) sections.push({
        id: 'places', title: t('search.places'),
        rows: s.geocodingResults.map(place => ({
            key: place.id,
            icon: <Building2 size={20} strokeWidth={1.5} />,
            title: place.name,
            subtitle: place.subtitle || undefined,
            testId: `search-item-place-${place.id}`,
            onSelect: () => s.selectPlace(place),
        })),
    });
    if (s.posResults.length > 0) sections.push({
        id: 'pos', title: t('search.pointsOfSale'),
        rows: s.posResults.map(result => ({
            key: result.pos.id,
            icon: <Ticket size={20} strokeWidth={1.5} />,
            title: result.pos.name,
            subtitle: posResultSubtitle(result, t),
            testId: `search-item-pos-${result.pos.id}`,
            onSelect: () => s.selectPos(result),
        })),
    });
    return sections;
};

/** Whether a typed query found nothing at all, so the "No results" state shows. */
export const hasNoResults = (sections: readonly SearchSection[], query: string, minLength: number): boolean =>
    query.length >= minLength && !sections.some(section => section.id !== 'recent' && section.id !== 'favorites');
