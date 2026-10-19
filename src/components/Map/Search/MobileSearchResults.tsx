import type React from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, BusFront, Search as SearchIcon, Star, Ticket } from 'lucide-react';
import { searchHistoryKey } from '@/lib/searchHistory';
import { cn } from '@/lib/cn';
import { STOP_SEARCH } from '@/config/constants';
import type { LineBadgeData } from '@/domain/routes';
import { getStopDistanceInfo } from '@/domain/stops';
import { vehicleDisplayNumber } from '@/domain/vehicles';
import type { PosSearchResult } from '@/domain/pointsOfSale';
import type { GeocodingResult } from '@/hooks/data/useGeocoding';
import { WalkDistance } from '@/components/WalkDistance';
import { StopModeIcon } from '@/components/StopModeIcon';
import type { ShownHistoryItem, Stop, VehicleFeature } from '@/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { HistoryItemIcon } from './HistoryItemIcon';
import { historyItemSubtitle, historyItemTitle, posResultSubtitle, stopResultSubtitle, vehicleResultLines } from './searchItemText';
import { LineBadges } from './SearchItem';
import { SheetSection as Section } from '@/components/Map/HomeSheet/SheetSection';

interface MobileSearchResultsProps {
    query: string;
    stopResults: Stop[];
    favoriteStops: Stop[];
    location: [number, number] | null;
    searchHistory: readonly ShownHistoryItem[];
    queryLines: string[] | null;
    queryLineBadges: LineBadgeData[] | null;
    vehicleResults: VehicleFeature[];
    geocodingResults: GeocodingResult[];
    posResults: PosSearchResult[];
    onStopSelect: (stop: Stop) => void;
    onHistorySelect: (item: ShownHistoryItem) => void;
    onClearHistory: () => void;
    onLineSelect: (lines: string[]) => void;
    onPlaceSelect: (result: GeocodingResult) => void;
    onPosSelect: (result: PosSearchResult) => void;
    onVehicleSelect: (vehicle: VehicleFeature) => void;
}

interface ResultRowProps {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    /** Shown on the right, such as the walking distance. */
    meta?: React.ReactNode;
    onClick: () => void;
    testId: string;
    /** Tints the icon like the home sheet's stop rows. */
    isStop?: boolean;
    children?: React.ReactNode;
}

const ResultRow = ({ icon, title, subtitle, meta, onClick, testId, isStop = false, children }: ResultRowProps) => (
    <Item variant="settings" size="none" className="flex-nowrap text-left" render={<button type="button" onClick={onClick} data-testid={testId} />}>
        <ItemMedia variant="icon" className={cn("size-9 rounded-full", isStop ? "bg-primary/10 text-primary" : "bg-foreground/5 text-muted-foreground")}>{icon}</ItemMedia>
        <ItemContent className="min-w-0 gap-1.5">
            <ItemTitle className="w-full text-title font-semibold text-foreground"><span className="truncate">{title}</span></ItemTitle>
            {children}
            {subtitle && <ItemDescription className="text-xs line-clamp-1">{subtitle}</ItemDescription>}
        </ItemContent>
        {meta && <ItemActions className="shrink-0">{meta}</ItemActions>}
    </Item>
);

/**
 * The phone's full-screen search results: favourite chips and recent searches before typing,
 * then grouped cards for lines, stops, vehicles, places and points of sale.
 */
export const MobileSearchResults = ({
    query, stopResults, favoriteStops, location, searchHistory, queryLines, queryLineBadges, vehicleResults, geocodingResults, posResults,
    onStopSelect, onHistorySelect, onClearHistory, onLineSelect, onPlaceSelect, onPosSelect, onVehicleSelect,
}: MobileSearchResultsProps) => {
    const { t } = useTranslation();
    const isEmptyQuery = query === '';
    const hasResults = stopResults.length > 0 || vehicleResults.length > 0 || posResults.length > 0 || geocodingResults.length > 0 || !!queryLines;

    const distanceTo = (stop: Stop) => {
        const info = getStopDistanceInfo(location, stop.pos);
        return info ? <WalkDistance info={info} /> : undefined;
    };

    const stopRow = (stop: Stop) => (
        <ResultRow
            key={stop.id}
            icon={<StopModeIcon lines={stop.lines} />}
            isStop
            title={stop.name}
            subtitle={stopResultSubtitle(stop, t)}
            meta={distanceTo(stop)}
            onClick={() => onStopSelect(stop)}
            testId={`search-item-res-stop-${stop.id}`}
        >
            <div className="flex flex-wrap items-center gap-y-1"><LineBadges lines={stop.lines} /></div>
        </ResultRow>
    );

    return (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pt-1 pb-[45dvh] flex flex-col gap-5" data-testid="search-results">
            {isEmptyQuery && favoriteStops.length > 0 && (
                <Section title={t('search.favorites')}>
                    <div className="-mx-6 flex gap-2 overflow-x-auto px-6">
                        {favoriteStops.map(stop => (
                            <Button
                                key={stop.id}
                                variant="outline"
                                size="sm"
                                className="shrink-0 rounded-full bg-card"
                                onClick={() => onStopSelect(stop)}
                                data-testid={`search-item-fav-stop-${stop.id}`}
                            >
                                <Star size={13} strokeWidth={1.5} className="fill-favorite text-favorite" />
                                {stop.name}
                            </Button>
                        ))}
                    </div>
                </Section>
            )}

            {isEmptyQuery && searchHistory.length > 0 && (
                <Section
                    title={t('search.recent')}
                    action={
                        <Button variant="link" size="sm" className="px-0" onClick={onClearHistory} data-testid="search-clear-history">
                            {t('search.clearRecent')}
                        </Button>
                    }
                >
                    <Card variant="inset" size="none" className="overflow-hidden">
                        {searchHistory.map(item => (
                            <ResultRow
                                key={searchHistoryKey(item)}
                                icon={<HistoryItemIcon type={item.type} />}
                                title={historyItemTitle(item, t)}
                                subtitle={historyItemSubtitle(item, t)}
                                onClick={() => onHistorySelect(item)}
                                testId={`search-item-hist-${searchHistoryKey(item)}`}
                            />
                        ))}
                    </Card>
                </Section>
            )}

            {queryLines && (
                <Section title={t('search.lines')}>
                    <Button
                        variant="outline"
                        className="h-12 justify-start gap-2 rounded-2xl bg-card px-4"
                        onClick={() => onLineSelect(queryLines)}
                        data-testid={`search-item-line-${queryLines.join('-')}`}
                    >
                        <LineBadges lines={queryLineBadges ?? undefined} />
                        <span className="text-title text-muted-foreground">{t('search.showOnMap')}</span>
                    </Button>
                </Section>
            )}

            {!isEmptyQuery && stopResults.length > 0 && (
                <Section title={t('search.stops')}>
                    <Card variant="inset" size="none" className="overflow-hidden">
                        {stopResults.map(stopRow)}
                    </Card>
                </Section>
            )}

            {vehicleResults.length > 0 && (
                <Section title={t('search.vehicles')}>
                    <Card variant="inset" size="none" className="overflow-hidden">
                        {vehicleResults.map(vehicle => {
                            const p = vehicle.properties;
                            const vehicleId = p.vehicle_id ?? '';
                            return (
                                <ResultRow
                                    key={vehicleId}
                                    icon={<BusFront size={18} strokeWidth={1.5} />}
                                    title={t('search.vehicleNumber', { number: vehicleDisplayNumber(vehicleId) })}
                                    subtitle={p.trip_headsign}
                                    onClick={() => onVehicleSelect(vehicle)}
                                    testId={`search-item-vehicle-${vehicleId}`}
                                >
                                    <div className="flex items-center"><LineBadges lines={vehicleResultLines(vehicle)} /></div>
                                </ResultRow>
                            );
                        })}
                    </Card>
                </Section>
            )}

            {geocodingResults.length > 0 && (
                <Section title={t('search.places')}>
                    <Card variant="inset" size="none" className="overflow-hidden">
                        {geocodingResults.map(place => (
                            <ResultRow
                                key={place.id}
                                icon={<Building2 size={18} strokeWidth={1.5} />}
                                title={place.name}
                                subtitle={place.subtitle || undefined}
                                onClick={() => onPlaceSelect(place)}
                                testId={`search-item-place-${place.id}`}
                            />
                        ))}
                    </Card>
                </Section>
            )}

            {posResults.length > 0 && (
                <Section title={t('search.pointsOfSale')}>
                    <Card variant="inset" size="none" className="overflow-hidden">
                        {posResults.map(result => (
                            <ResultRow
                                key={result.pos.id}
                                icon={<Ticket size={18} strokeWidth={1.5} />}
                                title={result.pos.name}
                                subtitle={posResultSubtitle(result, t)}
                                onClick={() => onPosSelect(result)}
                                testId={`search-item-pos-${result.pos.id}`}
                            />
                        ))}
                    </Card>
                </Section>
            )}

            {isEmptyQuery && searchHistory.length === 0 && (
                <p className="px-1 pt-2 text-body-sm leading-relaxed text-muted-foreground">{t('search.emptyHint')}</p>
            )}

            {query.length >= STOP_SEARCH.MIN_QUERY_LENGTH && !hasResults && (
                <Empty className="py-12">
                    <EmptyHeader>
                        <EmptyMedia variant="icon"><SearchIcon strokeWidth={1.5} /></EmptyMedia>
                        <EmptyTitle>{t('search.noResults')}</EmptyTitle>
                        <EmptyDescription>{t('search.noResultsHint')}</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            )}
        </div>
    );
};
