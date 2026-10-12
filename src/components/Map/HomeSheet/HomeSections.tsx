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
import { SheetSection } from './SheetSection';
import { CompactLineCard, CompactStopCard } from './CompactFavoriteCard';

interface HomeSectionsProps {
    /** The list scrolls only at full height, so at the lower heights a drag anywhere moves the sheet. */
    isFull: boolean;
}

/** The mobile home under the search button: disruptions, favourites, nearby stops and the network links. */
export const HomeSections = ({ isFull }: HomeSectionsProps) => {
    const { t } = useTranslation();
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const userLocation = useGeolocationStore(s => s.userLocation);
    const { setIsAlertsOpen, setIsFeedbackOpen, openAlert } = useUiStore(s => s.actions);
    const onLocate = useLocate();
    const { alerts, hasAlerts } = useAlerts();
    const incidentsCount = useMemo(() => countIncidents(alerts), [alerts]);

    const { allLines, allStops, stopIndex } = useFavorites();
    const { nearby, hasLocation } = useNearbyStops();

    const stopIds = useMemo(() => {
        const ids = new Set<string>();
        for (const pin of allStops) ids.add(pin.feature.properties.stop_id);
        for (const fav of allLines) ids.add(fav.stopId);
        for (const n of nearby) ids.add(n.feature.properties.stop_id);
        return [...ids];
    }, [allStops, allLines, nearby]);

    const { departuresByStop, isLoading } = useFavoriteDepartures(stopIds);
    const myIncidents = useMemo(
        () => incidentsOnLines(alerts, favoriteLineNames(allLines, allStops.map(pin => pin.feature))),
        [alerts, allLines, allStops],
    );
    const hasFavorites = allStops.length > 0 || allLines.length > 0;

    return (
        <div
            className={cn("flex-1 min-h-0 select-none overscroll-contain px-6 pt-1 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] flex flex-col gap-5", isFull ? "overflow-y-auto" : "overflow-hidden")}
            data-testid="home-sections"
        >
            {myIncidents.length > 0 && (
                <Item
                    variant="outline"
                    className="flex-nowrap rounded-2xl border-destructive/30 bg-destructive/10 text-left"
                    render={<button type="button" onClick={() => myIncidents[0].guid ? openAlert(myIncidents[0].guid) : setIsAlertsOpen(true)} data-testid="home-disruptions" />}
                >
                    <ItemMedia variant="icon" className="text-destructive"><AlertTriangle size={20} strokeWidth={1.5} /></ItemMedia>
                    <ItemContent className="min-w-0 gap-0.5">
                        <ItemTitle className="text-title font-semibold text-foreground">{t('home.disruptionsOnYourLines', { count: myIncidents.length })}</ItemTitle>
                        <ItemDescription className="text-xs line-clamp-1">{myIncidents[0].title}</ItemDescription>
                    </ItemContent>
                    <ItemActions><ChevronRight size={18} strokeWidth={1.5} className="text-muted-foreground" /></ItemActions>
                </Item>
            )}

            {!hasFavorites && (
                <SheetSection title={t('favorites.title')}>
                    <Card variant="inset" size="none">
                        <Item size="none" className="flex-nowrap px-4 py-3">
                            <ItemMedia variant="icon" className="self-center! translate-y-0! text-favorite"><Star size={20} strokeWidth={1.5} /></ItemMedia>
                            <ItemContent className="min-w-0">
                                <ItemDescription className="text-body-sm leading-snug">{t('favorites.emptySub')}</ItemDescription>
                            </ItemContent>
                        </Item>
                    </Card>
                </SheetSection>
            )}

            {hasFavorites && (
                <SheetSection
                    title={t('favorites.title')}
                    action={
                        <Button variant="link" size="sm" className="px-0" onClick={() => navigate(paths.favorites(selectedCity))}>
                            {t('home.seeAll')}
                        </Button>
                    }
                >
                    <div className="-mx-6 flex gap-2.5 overflow-x-auto px-6 pb-1 snap-x snap-mandatory scroll-px-6">
                        {allLines.map(fav => (
                            <CompactLineCard
                                key={`${fav.stopId}|${fav.line}|${fav.headsign}`}
                                favorite={fav}
                                stopFeature={stopIndex.get(fav.stopId)}
                                departures={departuresByStop.get(fav.stopId) ?? []}
                                isLoading={isLoading}
                            />
                        ))}
                        {allStops.map(pin => (
                            <CompactStopCard
                                key={pin.id}
                                stopFeature={pin.feature}
                                departures={departuresByStop.get(pin.feature.properties.stop_id) ?? []}
                                isLoading={isLoading}
                            />
                        ))}
                    </div>
                </SheetSection>
            )}

            <SheetSection title={t('home.nearby')}>
                {!hasLocation ? (
                    <Card variant="inset" size="none">
                        <Item size="none" className="flex-nowrap px-4 py-3">
                            <ItemMedia variant="icon" className="self-center! translate-y-0! text-muted-foreground"><MapPin size={20} strokeWidth={1.5} /></ItemMedia>
                            <ItemContent className="min-w-0">
                                <ItemDescription className="text-body-sm leading-snug">{t('home.locationNeeded')}</ItemDescription>
                            </ItemContent>
                            <ItemActions>
                                <Button variant="tinted" size="sm" className="rounded-full" onClick={(e) => onLocate(e)}>
                                    <LocateFixed size={15} strokeWidth={1.5} />
                                    {t('home.useLocationShort')}
                                </Button>
                            </ItemActions>
                        </Item>
                    </Card>
                ) : nearby.length === 0 ? (
                    <Card variant="inset" size="none">
                        <Item size="none" className="flex-nowrap px-4 py-3">
                            <ItemMedia variant="icon" className="self-center! translate-y-0! text-muted-foreground"><MapPin size={20} strokeWidth={1.5} /></ItemMedia>
                            <ItemContent className="min-w-0">
                                <ItemDescription className="text-body-sm leading-snug">{t('home.noNearby')}</ItemDescription>
                            </ItemContent>
                        </Item>
                    </Card>
                ) : (
                    <Card variant="inset" size="none" className="overflow-hidden">
                        {nearby.map(n => (
                            <NearbyStopRow
                                key={n.feature.properties.stop_id}
                                nearby={n}
                                location={userLocation}
                                departures={departuresByStop.get(n.feature.properties.stop_id) ?? []}
                            />
                        ))}
                    </Card>
                )}
            </SheetSection>

            <SheetSection title={t('home.network')}>
                <Card variant="inset" size="none" className="overflow-hidden">
                    {hasAlerts && (
                        <Item variant="settings" size="none" className="flex-nowrap text-left" render={<button type="button" onClick={() => setIsAlertsOpen(true)} data-testid="home-alerts-row" />}>
                            <ItemMedia variant="icon" className={incidentsCount > 0 ? "text-destructive" : "text-muted-foreground"}><AlertTriangle size={20} strokeWidth={1.5} /></ItemMedia>
                            <ItemContent><ItemTitle className="text-title text-foreground">{t('alerts.title')}</ItemTitle></ItemContent>
                            <ItemActions>
                                {incidentsCount > 0 && (
                                    <span className="min-w-5 rounded-full bg-destructive px-1.5 text-center text-xs font-bold leading-5 text-destructive-foreground">{incidentsCount}</span>
                                )}
                                <ChevronRight size={18} strokeWidth={1.5} className="text-muted-foreground" />
                            </ItemActions>
                        </Item>
                    )}
                    <Item variant="settings" size="none" className="flex-nowrap text-left" render={<button type="button" onClick={() => navigate(paths.stats(selectedCity))} />}>
                        <ItemMedia variant="icon" className="text-muted-foreground"><BarChart3 size={20} strokeWidth={1.5} /></ItemMedia>
                        <ItemContent><ItemTitle className="text-title text-foreground">{t('stats.title')}</ItemTitle></ItemContent>
                        <ItemActions><ChevronRight size={18} strokeWidth={1.5} className="text-muted-foreground" /></ItemActions>
                    </Item>
                    <Item variant="settings" size="none" className="flex-nowrap text-left" render={<button type="button" onClick={() => setIsFeedbackOpen(true)} />}>
                        <ItemMedia variant="icon" className="text-muted-foreground"><MessageSquare size={20} strokeWidth={1.5} /></ItemMedia>
                        <ItemContent><ItemTitle className="text-title text-foreground">{t('feedback.title')}</ItemTitle></ItemContent>
                        <ItemActions><ChevronRight size={18} strokeWidth={1.5} className="text-muted-foreground" /></ItemActions>
                    </Item>
                </Card>
            </SheetSection>
        </div>
    );
};
