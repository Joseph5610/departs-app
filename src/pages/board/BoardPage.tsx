import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Accessibility, Snowflake, Train, TrainFront } from 'lucide-react';
import { cn } from 'cn';
import { useNow } from '@/hooks/useNow';
import { useStops } from '@/hooks/data/useStops';
import { useBoardDepartures } from '@/hooks/data/useDepartures';
import { useInfotexts } from '@/hooks/data/useInfotexts';
import { AlertIcon } from '@/components/Alerts/AlertIcon';
import { useWakeLock } from '@/hooks/features/useWakeLock';
import { usePreferencesStore } from '@/state/preferencesStore';
import { FRONTEND_CITIES_CONFIG } from '@/config/cities';
import { BOARD_CONFIG } from '@/config/constants';
import { SITE } from '@/config/site';
import { LineBadge } from '@/components/LineBadge';
import { Badge } from '@/components/ui/badge';
import { DelayText } from '@/components/DelayText';
import { catchableDepartures } from '@/domain/departures';
import { activeNotices, noticesForStops, noticeText } from '@/domain/alerts';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import type { Departure } from '@/types';
import { formatTimetableClock } from '@/domain/time';
import { useCityConfig } from '@/hooks/data/useCities';

const readWalkMins = (): number => {
    const value = Number(new URLSearchParams(window.location.search).get('walk'));
    return (BOARD_CONFIG.WALK_OPTIONS_MIN as readonly number[]).includes(value) ? value : 0;
};

/** The stop's current notices in the footer, one at a time. */
const BoardNotices = ({ stopIds, now }: { stopIds: string[]; now: number }) => {
    const { i18n } = useTranslation();
    const infotexts = useInfotexts();
    const notices = useMemo(() => noticesForStops(infotexts ?? [], stopIds), [infotexts, stopIds]);
    const active = activeNotices(notices, now);
    if (active.length === 0) return null;

    const info = active[Math.floor(now / BOARD_CONFIG.NOTICE_ROTATE_MS) % active.length];
    const text = noticeText(info, i18n.resolvedLanguage);
    return (
        <footer className={cn(
            "flex items-center gap-[0.75em] px-[clamp(1rem,3vw,3rem)] py-[clamp(0.6rem,1.6vh,1.25rem)] border-t text-[clamp(0.85rem,1.6vw,1.5rem)] font-semibold",
            info.priority === 'high' ? "bg-destructive/15 border-destructive/40 text-foreground"
                : info.priority === 'normal' ? "bg-amber-500/10 border-amber-500/30 text-foreground"
                : "bg-muted/40 border-border text-muted-foreground"
        )}>
            <AlertIcon className={cn(
                "size-[1.2em] shrink-0",
                info.priority === 'high' ? "text-destructive!" : info.priority === 'normal' ? "text-amber-500!" : "text-muted-foreground"
            )} />
            <span key={info.id} className="min-w-0 line-clamp-2 whitespace-pre-line animate-in fade-in duration-500">{text}</span>
            {active.length > 1 && (
                <span className="ml-auto shrink-0 tabular-nums text-muted-foreground font-medium">
                    {active.indexOf(info) + 1}/{active.length}
                </span>
            )}
        </footer>
    );
};

/** One departure, laid out like the app's departure rows at board size. */
const BoardRow = ({ dep, timeZone, now, walkMins, stopPlatform }: { dep: Departure; timeZone: string; now: number; walkMins: number; stopPlatform?: string }) => {
    const { t } = useTranslation();
    const secondsLeft = Math.floor((Date.parse(dep.timestamp) - now) / 1000);
    const leaveSecs = secondsLeft - walkMins * 60;
    const showPlatform = !!dep.platform && dep.platform !== stopPlatform;

    const leaveText = walkMins === 0 || dep.isCanceled ? null
        : leaveSecs < 60 ? t('board.leaveNow')
        : t('board.leaveIn', { count: Math.floor(leaveSecs / 60) });

    return (
        <li className={cn(
            "grid grid-cols-[clamp(3rem,7vw,7rem)_minmax(0,1fr)_auto] items-center gap-x-[clamp(0.75rem,2vw,2rem)] px-[clamp(1rem,3vw,3rem)] py-[clamp(0.5rem,1.4vh,1.25rem)] border-b border-border/50 transition-opacity duration-500",
        )}>
            <LineBadge
                name={dep.line}
                routeColor={dep.route_color ?? ''}
                size="xl"
                className="w-full h-[clamp(2rem,4.5vw,4.25rem)] rounded-[clamp(0.4rem,0.8vw,0.9rem)] text-[clamp(1rem,2.3vw,2.25rem)]"
            />
            <div className="min-w-0">
                <div className={cn(
                    "font-semibold truncate text-[clamp(1.1rem,2.6vw,2.6rem)] leading-tight text-foreground",
                    dep.isCanceled && "line-through text-muted-foreground"
                )}>
                    {dep.headsign}
                </div>
                <div className="mt-[0.2em] flex items-center gap-[0.75em] text-[clamp(0.75rem,1.4vw,1.3rem)] text-muted-foreground tabular-nums">
                    <span className={cn("font-medium", dep.isCanceled && "line-through opacity-60")}>{formatTimetableClock(dep.scheduled, timeZone)}</span>
                    {!dep.isCanceled && <DelayText delay={dep.delay} />}
                    {dep.is_wheelchair_accessible && <Accessibility className="size-[1.1em] opacity-60" strokeWidth={1.5} aria-label={t('amenities.wheelchairAccessible')} />}
                    {dep.is_air_conditioned && <Snowflake className="size-[1.1em] opacity-60" strokeWidth={1.5} aria-label={t('amenities.airConditioned')} />}
                    {showPlatform && (
                        <span className="inline-flex items-center gap-[0.3em] px-[0.45em] py-[0.1em] bg-muted rounded-md border font-semibold">
                            <Train className="size-[0.9em] opacity-50" aria-hidden="true" />
                            {dep.platform}
                        </span>
                    )}
                    {leaveText && (
                        <span className={cn("font-semibold", leaveSecs < 60 ? "text-emerald-400" : "text-foreground")}>
                            {leaveText}
                        </span>
                    )}
                </div>
            </div>
            <div className="text-right font-bold tabular-nums leading-none text-[clamp(1.5rem,4vw,4rem)]">
                {dep.isCanceled ? (
                    <Badge variant="destructive" className="rounded-md font-semibold text-[0.4em] h-auto px-[0.5em] py-[0.25em]">{t('map.departures.canceled')}</Badge>
                ) : secondsLeft < 60 ? (
                    <span className="text-emerald-400 animate-pulse">{t('map.departures.now')}</span>
                ) : (
                    <span className="text-foreground">{Math.floor(secondsLeft / 60)}<span className="text-[0.45em] font-semibold text-muted-foreground ml-[0.15em]">min</span></span>
                )}
            </div>
        </li>
    );
};

/** Full-screen live departures of one stop for a wall screen: no controls beyond full screen; `?walk=` sets a walking time. */
const BoardPage = ({ city, stopId }: { city: string; stopId: string }) => {
    const { t, i18n } = useTranslation();
    const now = useNow();
    const { timezone } = useCityConfig(city);
    const clockFormat = useMemo(() => new Intl.DateTimeFormat(i18n.resolvedLanguage, { timeZone: timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }), [i18n.resolvedLanguage, timezone]);
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const { setSelectedCity } = usePreferencesStore(s => s.actions);
    const [walkMins] = useState(readWalkMins);

    useEffect(() => {
        if (FRONTEND_CITIES_CONFIG[city] && selectedCity !== city) setSelectedCity(city);
    }, [city, selectedCity, setSelectedCity]);

    useWakeLock(true);

    const { stopIndex } = useStops();
    const stop = stopIndex.get(stopId)?.properties;
    const stopNoticeIds = useMemo(() => stop ? [stop.stop_id, ...(stop.all_ids ?? [])] : [], [stop]);
    const isKnownCity = !!FRONTEND_CITIES_CONFIG[city];
    const { departures, isLoading, isError } = useBoardDepartures(selectedCity === city ? stopId : '');
    const rows = useMemo(() => {
        return catchableDepartures(departures, now, walkMins).slice(0, BOARD_CONFIG.MAX_ROWS);
    }, [departures, walkMins, now]);
    const listRef = useRef<HTMLUListElement>(null);

    // Re-run on every tick: a row that would be cut by the bottom edge is hidden, not shown half.
    useLayoutEffect(() => {
        const list = listRef.current;
        if (!list) return;
        for (const row of Array.from(list.children) as HTMLElement[]) {
            row.style.visibility = row.offsetTop + row.offsetHeight <= list.clientHeight ? '' : 'hidden';
        }
    });

    return (
        <div className="h-dvh flex flex-col bg-background text-foreground overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
            <header className="flex items-center gap-[clamp(0.75rem,2vw,2rem)] px-[clamp(1rem,3vw,3rem)] py-[clamp(0.75rem,2vh,1.75rem)] border-b border-border">
                <div className="min-w-0 flex-1">
                    <h1 className="flex items-center gap-[0.3em] font-bold text-[clamp(1.5rem,4vw,4rem)] leading-none min-w-0">
                        {stop?.platform_code && (
                            <span className="shrink-0 inline-flex items-center justify-center size-[0.9em] rounded-full bg-foreground text-background shadow-sm">
                                <span className="text-[0.5em] font-bold leading-none tabular-nums">{stop.platform_code}</span>
                            </span>
                        )}
                        <span className="truncate">{stop?.stop_name ?? '…'}</span>
                    </h1>
                    {walkMins > 0 && (
                        <div className="mt-[0.4em] text-[clamp(0.75rem,1.3vw,1.1rem)] text-muted-foreground font-medium">
                            {t('board.withWalk', { count: walkMins })}
                        </div>
                    )}
                </div>
                <div className="shrink-0 text-right">
                    <div className="font-bold tabular-nums text-[clamp(1.5rem,4vw,4rem)] leading-none">{clockFormat.format(now)}</div>
                    <div className="mt-[0.5em] micro-label-widest text-muted-foreground">{SITE.NAME}</div>
                </div>
            </header>

            {rows.length > 0 ? (
                <ul ref={listRef} className="relative flex-1 overflow-hidden">
                    {rows.map(dep => (
                        <BoardRow key={`${dep.tripId ?? dep.line}-${dep.scheduled}`} dep={dep} timeZone={timezone} now={now} walkMins={walkMins} stopPlatform={stop?.platform_code} />
                    ))}
                </ul>
            ) : (isError || !isKnownCity) ? (
                <Empty className="flex-1">
                    <EmptyHeader className="max-w-[min(90vw,48rem)] gap-[clamp(0.5rem,1.5vh,1.25rem)]">
                        <EmptyTitle className="text-[clamp(1.25rem,3vw,3rem)] font-bold leading-tight">{t(isKnownCity ? 'board.unavailable' : 'board.unknownStop')}</EmptyTitle>
                        <EmptyDescription className="text-[clamp(0.9rem,1.6vw,1.6rem)]">{t(isKnownCity ? 'board.unavailableDescription' : 'board.unknownStopDescription')}</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : !isLoading && (
                <Empty className="flex-1">
                    <EmptyHeader className="max-w-[min(90vw,48rem)] gap-[clamp(0.5rem,1.5vh,1.25rem)]">
                        <EmptyMedia
                            variant="icon"
                            className="size-[clamp(3.5rem,7vw,7rem)] rounded-[clamp(0.9rem,1.6vw,1.75rem)] bg-muted/30 border border-border/50 text-muted-foreground [&_svg:not([class*='size-'])]:size-[55%]"
                        >
                            <TrainFront strokeWidth={1.5} className="opacity-60" />
                        </EmptyMedia>
                        <EmptyTitle className="text-[clamp(1.25rem,3vw,3rem)] font-bold leading-tight">{t('map.departures.noUpcoming')}</EmptyTitle>
                        <EmptyDescription className="text-[clamp(0.9rem,1.6vw,1.6rem)]">{t('map.departures.noUpcomingDescription')}</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            )}
            {stop && <BoardNotices stopIds={stopNoticeIds} now={now} />}
        </div>
    );
};

export default BoardPage;
