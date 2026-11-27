import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { LineBadge } from '@/components/LineBadge';
import { StruckTime } from '@/components/StruckTime';
import { PlatformCircle } from '@/components/PlatformCircle';
import { AmenityIcons } from '@/components/AmenityIcons';
import { Countdown } from '@/components/DetailPanel/DepartureBoard/Countdown';
import { LiveSignal } from '@/components/DetailPanel/DepartureBoard/LiveSignal';
import { boardingPlace, departureClock, leaveInMinutes, liveStatus, otherPlatform } from '@/domain/departures';
import type { Departure } from '@/types';

interface BoardDepartureRowProps {
    departure: Departure;
    timeZone: string;
    now: number;
    walkMins: number;
    /** The board's own platform, left unnamed on its rows. */
    boardPlatform?: string;
}

/** One departure on the full-screen board, laid out like the app's departure rows at wall size. */
export const BoardDepartureRow = ({ departure: dep, timeZone, now, walkMins, boardPlatform }: BoardDepartureRowProps) => {
    const { t } = useTranslation();
    const { track } = boardingPlace(dep);
    const platform = otherPlatform(dep, boardPlatform);
    const leaveMins = leaveInMinutes(dep, now, walkMins);

    return (
        <li className="grid grid-cols-[var(--spacing-board-badge-col)_minmax(0,1fr)_auto] items-center gap-x-board-gap border-b border-border/50 px-board-gutter py-[clamp(0.5rem,1.4vh,1.25rem)]">
            <LineBadge name={dep.line} routeColor={dep.route_color ?? ''} size="xl" />
            <div className="min-w-0">
                <div className={cn(
                    "flex min-w-0 items-center gap-[0.35em] text-board-headsign font-semibold leading-tight text-foreground",
                    dep.isCanceled && "line-through text-muted-foreground"
                )}>
                    {track && <PlatformCircle code={track} size="fluid" />}
                    <span className="truncate">{dep.headsign}</span>
                </div>
                <div className="mt-[0.2em] flex items-center gap-[0.75em] text-board-meta text-muted-foreground tabular-nums">
                    <StruckTime {...departureClock(dep, timeZone)} isCanceled={dep.isCanceled} className="font-medium" />
                    <AmenityIcons wheelchairAccessible={dep.is_wheelchair_accessible} airConditioned={dep.is_air_conditioned} size="fluid" />
                    {platform && <span>{t('map.departures.platformCode', { code: platform })}</span>}
                    {leaveMins !== null && (
                        <span className={cn("font-semibold", leaveMins <= 0 ? "text-tint-mint" : "text-foreground")}>
                            {leaveMins <= 0 ? t('board.leaveNow') : t('board.leaveIn', { count: leaveMins })}
                        </span>
                    )}
                </div>
            </div>
            <div className="text-right text-board-display font-bold tabular-nums leading-none">
                {dep.isCanceled ? (
                    <span className="text-[0.45em] font-semibold text-destructive">{t('map.departures.canceled')}</span>
                ) : (
                    <span className="flex items-center justify-end gap-[0.3em]">
                        <LiveSignal status={liveStatus(dep)} className="size-[0.45em]" />
                        <Countdown timestamp={dep.timestamp} />
                    </span>
                )}
            </div>
        </li>
    );
};
