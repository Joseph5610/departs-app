import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { navigate } from '@/lib/history';
import { paths } from '@/lib/routes';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useMapMetadataStore } from '@/state/mapMetadataStore';
import { useGeolocationStore } from '@/state/geolocationStore';
import { formatStopDistance } from '@/hooks/derived/useStopDistance';
import { getStopDistanceInfo } from '@/domain/stops';
import { nextDepartures } from '@/domain/departures';
import { cn } from 'cn';
import { FavoriteDepartureRow } from './FavoriteDepartureRow';
import { Badge } from '@/components/ui/badge';
import { CardTitle } from '@/components/ui/card';
import { FavoriteCard } from './FavoriteCard';
import {
    MAP_CAMERA,
    DEPARTURES_CONFIG
} from '@/config/constants';
import type { StopFeature, Departure } from '@/types';
import { useCityConfig } from '@/hooks/data/useCities';

interface FavoritesStopCardProps {
    stopFeature: StopFeature;
    departures: Departure[];
    isLoading: boolean;
    isError: boolean;
}

export const FavoritesStopCard = ({ 
    stopFeature, 
    departures, 
    isLoading, 
    isError
}: FavoritesStopCardProps) => {
    const { t } = useTranslation();
    const { timezone } = useCityConfig();

    const flyTo = useMapMetadataStore(s => s.actions.flyTo);

    const userLocation = useGeolocationStore(s => s.userLocation);

    const { toggleFavorite } = usePreferencesStore(s => s.actions);
    const selectedCity = usePreferencesStore(s => s.selectedCity);

    const { stop_id, stop_name, platform_code } = stopFeature.properties;
    const coordinates = stopFeature.geometry.coordinates as [number, number];

    const stopDistanceInfo = useMemo(
        () => getStopDistanceInfo(userLocation, coordinates),
        [userLocation, coordinates]
    );

    const distanceLabel = stopDistanceInfo ? formatStopDistance(stopDistanceInfo, t) : '';

    const next2Departures = useMemo(() => (departures?.length ? nextDepartures(departures, DEPARTURES_CONFIG.FAVORITE_CARD_COUNT) : []), [departures]);

    const handleCardClick = () => {
        flyTo({
            center: coordinates,
            zoom: MAP_CAMERA.STOP_SELECT_ZOOM,
            duration: MAP_CAMERA.FLY_MS
        });
        
        navigate(paths.stop(selectedCity, stop_id));
    };

    return (
        <FavoriteCard
            onOpen={handleCardClick}
            onUnpin={() => toggleFavorite(stop_id)}
            unpinLabel={t('map.departures.removeFromFavorites')}
            header={
                <div className="min-w-0 flex-1">
                    <CardTitle className="flex items-center gap-1.5 text-sm font-semibold leading-tight truncate min-w-0">
                        {platform_code && (
                            <Badge 
                                variant="outline"
                                className="w-5 h-5 p-0 flex items-center justify-center rounded-full shrink-0 border-0 bg-foreground text-background text-[10.5px] font-bold shadow-sm tabular-nums"
                            >
                                {platform_code}
                            </Badge>
                        )}
                        <span className="truncate">{stop_name}</span>
                    </CardTitle>
                    {stopDistanceInfo && (
                        <div className={cn(
                            "text-xs font-medium mt-0.5",
                            stopDistanceInfo.isAtStop ? "text-primary font-semibold" : "text-foreground/60"
                        )}>
                            {distanceLabel}
                        </div>
                    )}
                </div>
            }
        >
                {isLoading ? (
                    <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground text-xs">
                        <Loader2 size={14} className="animate-spin text-primary"  strokeWidth={1.5} />
                        <span>{t('common.loading')}</span>
                    </div>
                ) : isError ? (
                    <div className="text-xs text-destructive py-4 text-center">
                        {t('errors.generic')}
                    </div>
                ) : next2Departures.length === 0 ? (
                    <div className="text-xs text-muted-foreground py-4 text-center">
                        {t('map.departures.noUpcoming')}
                    </div>
                ) : (
                    <div className="flex flex-col divide-y divide-black/5 dark:divide-white/5">
                        {next2Departures.map((dep, idx) => (
                            <FavoriteDepartureRow key={dep.tripId ? `${dep.tripId}-${dep.scheduled}` : idx} dep={dep} timeZone={timezone} isOdd={idx % 2 === 1} showLine />
                        ))}
                    </div>
                )}
        </FavoriteCard>
    );
};
