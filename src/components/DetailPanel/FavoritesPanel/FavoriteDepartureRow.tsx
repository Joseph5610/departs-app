import { useTranslation } from 'react-i18next';
import { Train } from 'lucide-react';
import { cn } from 'cn';
import { DelayText } from '@/components/DelayText';
import { Countdown } from '@/components/DetailPanel/DepartureBoard/Countdown';
import { LineBadge } from '@/components/LineBadge';
import { IconTooltip } from '@/components/IconTooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FALLBACK_ROUTE_COLOR } from '@/config/constants';
import type { Departure } from '@/types';
import { formatTimetableClock } from '@/domain/time';
import { navigate } from '@/lib/history';
import { paths } from '@/lib/routes';
import { usePreferencesStore } from '@/state/preferencesStore';

/** One departure in a favourite stop's card, opening its trip. */
export const FavoriteDepartureRow = ({ dep, timeZone }: { dep: Departure; timeZone: string }) => {
    const { t } = useTranslation();
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const isTrain = dep.type === 'train';
    const { tripId } = dep;

    return (
        <Button
            variant="ghost"
            size="row"
            onClick={tripId ? () => navigate(paths.trip(selectedCity, tripId, dep.vehicleId)) : undefined}
            data-testid={`favorite-departure-${tripId}`}
            className={cn("text-foreground hover:text-foreground", tripId ? "hover:bg-muted/50" : "cursor-default")}
        >
            <div className="flex flex-col shrink-0 w-12 gap-0.5">
                <span className={cn(
                    "text-muted-foreground text-sm font-medium leading-tight tabular-nums",
                    dep.isCanceled && "line-through opacity-60"
                )}>
                    {formatTimetableClock(dep.scheduled, timeZone)}
                </span>
                {!dep.isCanceled && <DelayText delay={dep.delay} className="text-xs leading-none" />}
            </div>

            <div className="flex items-center gap-2 min-w-0 flex-1">
                <LineBadge
                    name={String(dep.line)}
                    routeColor={dep.route_color || FALLBACK_ROUTE_COLOR}
                />
                <span className={cn(
                    "text-foreground text-sm font-medium truncate min-w-0 leading-tight",
                    dep.isCanceled && "line-through text-muted-foreground"
                )}>
                    {dep.headsign}
                </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                {dep.platform && isTrain && (
                    <IconTooltip
                        label={t('map.departures.platform')}
                        className="justify-center min-w-6 gap-1 px-1.5 py-0.5 bg-muted rounded-md border text-xs font-semibold text-muted-foreground leading-none tabular-nums"
                    >
                        <Train size={12} className="size-3 opacity-50" aria-hidden="true" />
                        <span>{dep.platform}</span>
                    </IconTooltip>
                )}

                {dep.isCanceled ? (
                    <Badge variant="destructive" className="rounded-md font-semibold">
                        {t('map.departures.canceled')}
                    </Badge>
                ) : (
                    <span className="text-sm font-bold leading-none shrink-0 min-w-12 text-right tabular-nums">
                        <Countdown timestamp={dep.timestamp} />
                    </span>
                )}
            </div>
        </Button>
    );
};
