import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, MapPinOff, TrainFront } from 'lucide-react';
import { useNow } from '@/hooks/useNow';
import { useSelectedStop } from '@/hooks/derived/useSelectedStop';
import { boardStopIds } from '@/domain/stops';
import { useBoardDepartures } from '@/hooks/data/useDepartures';
import { useWakeLock } from '@/hooks/features/useWakeLock';
import { useCityConfig } from '@/hooks/data/useCities';
import { usePreferencesStore } from '@/state/preferencesStore';
import { FRONTEND_CITIES_CONFIG } from '@/config/cities';
import { BOARD_CONFIG } from '@/config/constants';
import { boardWalkParam } from '@/lib/routes';
import { catchableDepartures, departureKey, offeredWalkMins } from '@/domain/departures';
import { EmptyState } from '@/components/EmptyState';
import { BoardHeader } from '@/components/Board/BoardHeader';
import { BoardDepartureRow } from '@/components/Board/BoardDepartureRow';
import { BoardNotices } from '@/components/Board/BoardNotices';

/** Full-screen live departures of one stop for a wall screen: no controls beyond full screen; `?walk=` sets a walking time. */
const BoardPage = ({ city, stopId }: { city: string; stopId: string }) => {
    const { t } = useTranslation();
    const now = useNow();
    const { timezone } = useCityConfig(city);
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const { setSelectedCity } = usePreferencesStore(s => s.actions);
    const [walkMins] = useState(() => offeredWalkMins(boardWalkParam(window.location.search)));
    const isKnownCity = !!FRONTEND_CITIES_CONFIG[city];

    useEffect(() => {
        if (isKnownCity && selectedCity !== city) setSelectedCity(city);
    }, [isKnownCity, city, selectedCity, setSelectedCity]);

    useWakeLock(true);

    const stop = useSelectedStop(stopId)?.board;
    const stopNoticeIds = useMemo(() => stop ? boardStopIds(stop) : [], [stop]);
    const { departures, isLoading, isError } = useBoardDepartures(selectedCity === city ? stopId : '');
    const rows = useMemo(() => catchableDepartures(departures, now, walkMins).slice(0, BOARD_CONFIG.MAX_ROWS), [departures, walkMins, now]);
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
        <div className="flex h-dvh flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] text-foreground">
            <BoardHeader name={stop?.name} code={stop?.code} now={now} timeZone={timezone} />

            {rows.length > 0 ? (
                <ul ref={listRef} className="relative flex-1 overflow-hidden">
                    {rows.map(dep => (
                        <BoardDepartureRow key={departureKey(dep)} departure={dep} timeZone={timezone} now={now} walkMins={walkMins} boardPlatform={stop?.code} />
                    ))}
                </ul>
            ) : !isKnownCity ? (
                <EmptyState size="board" tone="error" icon={MapPinOff} title={t('board.unknownStop')} description={t('board.unknownStopDescription')} />
            ) : isError ? (
                <EmptyState size="board" tone="error" icon={AlertCircle} title={t('board.unavailable')} description={t('board.unavailableDescription')} />
            ) : !isLoading && (
                <EmptyState size="board" icon={TrainFront} title={t('map.departures.noUpcoming')} description={t('map.departures.noUpcomingDescription')} />
            )}
            {stop && <BoardNotices stopIds={stopNoticeIds} now={now} />}
        </div>
    );
};

export default BoardPage;
