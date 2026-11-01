import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, BarChart3, ChevronRight, LocateFixed, MapPin, MessageSquare, Star } from 'lucide-react';
import { cn } from '@/lib/cn';
import { navigate } from '@/lib/history';
import { paths } from '@/lib/routes';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useUiStore } from '@/state/uiStore';
import { useGeolocationStore } from '@/state/geolocationStore';
import { useFavorites } from '@/hooks/derived/useFavorites';
import { useNearbyStops } from '@/hooks/derived/useNearbyStops';
import { useFavoriteDepartures } from '@/hooks/data/useFavoriteDepartures';
import { useAlerts } from '@/hooks/data/useAlerts';
import { useLocate } from '@/hooks/features/useGeolocation';
import { countIncidents, incidentsOnLines } from '@/domain/alerts';
import { favoriteLineNames } from '@/domain/departures';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { NearbyStopRow } from './NearbyStopRow';
import { HomeSection } from './HomeSection';
import { CompactLineCard, CompactStopCard } from './CompactFavoriteCard';

interface HomeSectionsProps {
    /** The list scrolls only at full height, so at the lower heights a drag anywhere moves the sheet. */
    isFull: boolean;
    /** At the peek only the search row shows, so the departures refresh rarely. */
    isPeek: boolean;
}

/** The mobile home under the search button: disruptions, favourites, nearby stops and the network links. */
export const HomeSections = ({ isFull, isPeek }: HomeSectionsProps) => {
    const { t } = useTranslation();
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const userLocation = useGeolocationStore(s => s.userLocation);
    const { setIsAlertsOpen, setIsFeedbackOpen, openAlert } = useUiStore(s => s.actions);
    const onLocate = useLocate();
    const { alerts, hasAlerts } = useAlerts();
    const incidentsCount = useMemo(() => countIncidents(alerts), [alerts]);

    const { allLines, allStops, lineStops } = useFavorites();
    const { nearby, hasLocation } = useNearbyStops();

    const stopIds = useMemo(() => {
        const ids = new Set<string>();
        for (const pin of allStops) ids.add(pin.stop.id);
        for (const fav of allLines) ids.add(fav.stopId);
        for (const n of nearby) ids.add(n.stop.id);
        return [...ids];
    }, [allStops, allLines, nearby]);

    const { departuresByStop, isLoading } = useFavoriteDepartures(stopIds, isPeek);
    const myIncidents = useMemo(
        () => incidentsOnLines(alerts, favoriteLineNames(allLines, allStops.map(pin => pin.stop))),
        [alerts, allLines, allStops],
    );
    const hasFavorites = allStops.length > 0 || allLines.length > 0;

    return (
        <div
            className={cn("flex-1 min-h-0 select-none overscroll-contain px-(--panel-gutter) pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+2.5rem)] flex flex-col gap-5", isFull ? "overflow-y-auto" : "overflow-hidden")}
            data-testid="home-sections"
        >
            {myIncidents.length > 0 && (
                <Item
                    size="none"
                    className="flex-nowrap rounded-surface border-0 bg-tint-red/16 px-3.5 py-3 text-left"
                    render={<button type="button" onClick={() => myIncidents[0].guid ? openAlert(myIncidents[0].guid) : setIsAlertsOpen(true)} data-testid="home-disruptions" />}
                >
                    <ItemMedia variant="rowIcon" className="text-destructive"><AlertTriangle size={20} strokeWidth={1.75} /></ItemMedia>
                    <ItemContent className="min-w-0 gap-0.5">
                        <ItemTitle className="type-row text-foreground">{t('home.disruptionsOnYourLines', { count: myIncidents.length })}</ItemTitle>
                        <ItemDescription className="type-meta line-clamp-1">{myIncidents[0].title}</ItemDescription>
                    </ItemContent>
                    <ItemActions><ChevronRight size={17} strokeWidth={1.75} className="text-label-3" /></ItemActions>
                </Item>
            )}

            {!hasFavorites && (
                <HomeSection title={t('favorites.title')}>
                    <Card size="none">
                        <Item variant="row" size="none" >
                            <ItemMedia variant="rowIcon" className="text-favorite"><Star size={20} strokeWidth={1.75} /></ItemMedia>
                            <ItemContent className="min-w-0">
                                <ItemDescription className="type-meta">{t('favorites.emptySub')}</ItemDescription>
                            </ItemContent>
                        </Item>
                    </Card>
                </HomeSection>
            )}

            {hasFavorites && (
                <HomeSection title={t('favorites.title')} onOpen={() => navigate(paths.favorites(selectedCity))}>
                    <div className="-mx-(--panel-gutter) flex gap-2.5 overflow-x-auto px-(--panel-gutter) pb-1 snap-x snap-mandatory scroll-px-(--panel-gutter)">
                        {allLines.map(fav => (
                            <CompactLineCard
                                key={`${fav.stopId}|${fav.line}|${fav.headsign}`}
                                favorite={fav}
                                stop={lineStops.get(fav.stopId)}
                                departures={departuresByStop.get(fav.stopId) ?? []}
                                isLoading={isLoading}
                            />
                        ))}
                        {allStops.map(pin => (
                            <CompactStopCard
                                key={pin.stop.id}
                                stop={pin.stop}
                                departures={departuresByStop.get(pin.stop.id) ?? []}
                                isLoading={isLoading}
                            />
                        ))}
                    </div>
                </HomeSection>
            )}

            <HomeSection title={t('home.nearby')}>
                {!hasLocation ? (
                    <Card size="none">
                        <Item variant="row" size="none" >
                            <ItemMedia variant="rowIcon" className="text-muted-foreground"><MapPin size={20} strokeWidth={1.75} /></ItemMedia>
                            <ItemContent className="min-w-0">
                                <ItemDescription className="type-meta">{t('home.locationNeeded')}</ItemDescription>
                            </ItemContent>
                            <ItemActions>
                                <Button variant="secondary" size="sm" onClick={(e) => onLocate(e)}>
                                    <LocateFixed size={15} strokeWidth={1.75} />
                                    {t('home.useLocationShort')}
                                </Button>
                            </ItemActions>
                        </Item>
                    </Card>
                ) : nearby.length === 0 ? (
                    <Card size="none">
                        <Item variant="row" size="none" >
                            <ItemMedia variant="rowIcon" className="text-muted-foreground"><MapPin size={20} strokeWidth={1.75} /></ItemMedia>
                            <ItemContent className="min-w-0">
                                <ItemDescription className="type-meta">{t('home.noNearby')}</ItemDescription>
                            </ItemContent>
                        </Item>
                    </Card>
                ) : (
                    <Card size="none" className="overflow-hidden">
                        {nearby.map(n => (
                            <NearbyStopRow
                                key={n.stop.id}
                                nearby={n}
                                location={userLocation}
                                departures={departuresByStop.get(n.stop.id) ?? []}
                            />
                        ))}
                    </Card>
                )}
            </HomeSection>

            <HomeSection title={t('home.network')}>
                <Card size="none" className="overflow-hidden">
                    {hasAlerts && (
                        <Item variant="row" size="none" render={<button type="button" onClick={() => setIsAlertsOpen(true)} data-testid="home-alerts-row" />}>
                            <ItemMedia variant="rowIcon" className={incidentsCount > 0 ? "text-destructive" : "text-muted-foreground"}><AlertTriangle size={20} strokeWidth={1.75} /></ItemMedia>
                            <ItemContent><ItemTitle className="type-row text-foreground">{t('alerts.title')}</ItemTitle></ItemContent>
                            <ItemActions>
                                {incidentsCount > 0 && (
                                    <span className="min-w-5 rounded-full bg-destructive px-1.5 text-center type-control text-destructive-foreground">{incidentsCount}</span>
                                )}
                                <ChevronRight size={17} strokeWidth={1.75} className="text-label-3" />
                            </ItemActions>
                        </Item>
                    )}
                    <Item variant="row" size="none" render={<button type="button" onClick={() => navigate(paths.stats(selectedCity))} />}>
                        <ItemMedia variant="rowIcon" className="text-muted-foreground"><BarChart3 size={20} strokeWidth={1.75} /></ItemMedia>
                        <ItemContent><ItemTitle className="type-row text-foreground">{t('stats.title')}</ItemTitle></ItemContent>
                        <ItemActions><ChevronRight size={17} strokeWidth={1.75} className="text-label-3" /></ItemActions>
                    </Item>
                    <Item variant="row" size="none" render={<button type="button" onClick={() => setIsFeedbackOpen(true)} />}>
                        <ItemMedia variant="rowIcon" className="text-muted-foreground"><MessageSquare size={20} strokeWidth={1.75} /></ItemMedia>
                        <ItemContent><ItemTitle className="type-row text-foreground">{t('feedback.title')}</ItemTitle></ItemContent>
                        <ItemActions><ChevronRight size={17} strokeWidth={1.75} className="text-label-3" /></ItemActions>
                    </Item>
                </Card>
            </HomeSection>
        </div>
    );
};
