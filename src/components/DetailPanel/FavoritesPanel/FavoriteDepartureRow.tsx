import { useTranslation } from 'react-i18next';
import { Train } from 'lucide-react';
import { cn } from 'cn';
import { DelayText } from '@/components/DelayText';
import { Countdown } from '@/components/DetailPanel/DepartureBoard/Countdown';
import { LineBadge } from '@/components/LineBadge';
import { IconTooltip } from '@/components/IconTooltip';
import { Badge } from '@/components/ui/badge';
import { FALLBACK_ROUTE_COLOR } from '@/config/constants';
import type { Departure } from '@/types';
import { formatTimetableClock } from '@/domain/time';

/** One departure in a favourites card; a pinned line's card leaves out the line and headsign it already shows. */
export const FavoriteDepartureRow = ({ dep, timeZone, isOdd, showLine = false }: { dep: Departure; timeZone: string; isOdd: boolean; showLine?: boolean }) => {
    const { t } = useTranslation();
    const isTrain = dep.type === 'train';

    return (
        <div className={cn(
            "flex items-center gap-3 min-h-11 py-1.5 px-4",
            isOdd && "bg-black/[0.015] dark:bg-white/[0.02]"
        )}>
            <div className="flex flex-col shrink-0 w-10 gap-0.5">
                <span className={cn(
                    "text-muted-foreground text-[13px] font-medium leading-tight tabular-nums",
                    dep.isCanceled && "line-through opacity-60"
                )}>
                    {formatTimetableClock(dep.scheduled, timeZone)}
                </span>
                {!dep.isCanceled && <DelayText delay={dep.delay} className="text-[11px] leading-none" />}
            </div>

            <div className="flex items-center gap-2 min-w-0 flex-1">
                {showLine && (
                    <>
                        <LineBadge
                            name={String(dep.line)}
                            routeColor={dep.route_color || FALLBACK_ROUTE_COLOR}
                        />
                        <span className={cn(
                            "text-foreground text-[13px] font-medium truncate min-w-0 leading-tight",
                            dep.isCanceled && "line-through text-muted-foreground"
                        )}>
                            {dep.headsign}
                        </span>
                    </>
                )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
                {dep.platform && isTrain && (
                    <IconTooltip
                        label={t('map.departures.platform')}
                        className="justify-center min-w-6 gap-1 px-1.5 py-0.5 bg-muted rounded-md border text-xs font-semibold text-muted-foreground leading-none tabular-nums"
                    >
                        <Train size={12} className="opacity-50" aria-hidden="true" />
                        <span>{dep.platform}</span>
                    </IconTooltip>
                )}

                {dep.isCanceled ? (
                    <Badge variant="destructive" className="rounded-md font-semibold">
                        {t('map.departures.canceled')}
                    </Badge>
                ) : (
                    <span className="text-sm font-bold leading-none text-right min-w-12 tabular-nums">
                        <Countdown timestamp={dep.timestamp} />
                    </span>
                )}
            </div>
        </div>
    );
};
