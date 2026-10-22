import type React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { CornerDownRight, Hourglass } from 'lucide-react';
import { cn } from '@/lib/cn';
import { AnimatePresence, motion } from 'framer-motion';
import { IconTooltip } from '@/components/IconTooltip';
import { AmenityIcons } from '@/components/AmenityIcons';
import { StruckTime } from '@/components/StruckTime';
import { departureClock, feederNotice, liveStatus, type FeederNotice } from '@/domain/departures';
import type { TripMark } from '@/hooks/derived/useTripMark';
import { useRecentDelta } from '@/hooks/features/useRecentDelta';
import { useFlash } from '@/hooks/features/useFlash';
import { useLiveStatusLabel } from '@/hooks/derived/useLiveStatusLabel';
import { DEPARTURES_CONFIG, FALLBACK_ROUTE_COLOR } from '@/config/constants';
import { LineBadge } from '@/components/LineBadge';
import { formatDelay } from '@/domain/delay';
import type { Departure } from '@/types';
import { Countdown } from './Countdown';
import { LiveIndicator } from './LiveIndicator';

/** The label a marked departure carries; the user's own trip has its filled bell instead. */
const TRIP_MARK_LABEL: Record<TripMark, string | null> = {
    riding: null,
    watched: 'map.departures.watchedTrip',
    viewed: 'map.departures.viewedTrip',
};

/** How a departure row stands out when it is the ridden, followed or viewed trip. */
export const MARKED_ROW = 'bg-primary/10 hover:bg-primary/15';

/** MARKED_ROW for a row whose background is its `before` backdrop. */
export const MARKED_BACKDROP = 'before:bg-primary/10 hover:before:bg-primary/15';

/** A departure's timetable time, struck through with the expected time beside it once live data moves it. */
export const ExpectedTime = ({ departure: dep, timeZone }: { departure: Departure; timeZone: string }) => {
    const { scheduled, expected } = departureClock(dep, timeZone);
    return <StruckTime scheduled={scheduled} expected={expected} isCanceled={dep.isCanceled} />;
};

/**
 * The live countdown with its status indicator. A fresh delay change turns the indicator into a trend triangle
 * and rolls the change through the countdown's place for a moment; the countdown then keeps the trend colour
 * until the change settles. "Cancelled" instead when cancelled.
 */
export const LiveCountdown = ({ departure: dep, size }: { departure: Departure; size: 'lg' | 'md' }) => {
    const { t } = useTranslation();
    const delta = dep.delayDelta ?? 0;
    const isChanging = useRecentDelta(delta, dep.lastDelayUpdate);
    const trend = isChanging ? (delta > 0 ? 'up' : 'down') : null;
    const showsChange = useFlash(trend ? dep.lastDelayUpdate : undefined, DEPARTURES_CONFIG.DELAY_DELTA_FLASH_MS);
    const statusLabel = useLiveStatusLabel(dep);
    if (dep.isCanceled) {
        return <span className="justify-self-end text-sm font-semibold text-destructive">{t('map.departures.canceled')}</span>;
    }
    return (
        // A fixed minimum width keeps the headsign column steady as the countdown ticks or rolls to a change.
        <span className={cn("flex items-center justify-end gap-1.5 justify-self-end", size === 'lg' ? "min-w-16" : "min-w-15")}>
            {statusLabel ? (
                <IconTooltip label={statusLabel}><LiveIndicator status={liveStatus(dep)} trend={trend} /></IconTooltip>
            ) : <LiveIndicator status={liveStatus(dep)} trend={trend} />}
            <span className={cn(
                "grid overflow-hidden text-right font-bold tracking-tight tabular-nums transition-colors duration-700",
                size === 'lg' ? "h-6 text-heading leading-6" : "h-5 text-title leading-5",
                trend === 'up' ? "text-destructive" : trend === 'down' ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
            )}>
                <AnimatePresence initial={false}>
                    <motion.span
                        key={showsChange ? 'change' : 'countdown'}
                        initial={{ y: '100%', opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: '-100%', opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                        className="col-start-1 row-start-1 block justify-self-end"
                    >
                        {showsChange ? formatDelay(delta) : <Countdown timestamp={dep.timestamp} />}
                    </motion.span>
                </AnimatePresence>
            </span>
        </span>
    );
};

/** Step-free and air-conditioning icons of a departure. */
export const Amenities = ({ departure: dep }: { departure: Departure }) => (
    <AmenityIcons wheelchairAccessible={dep.is_wheelchair_accessible} airConditioned={dep.is_air_conditioned} />
);

/** A departure's feeder notice, the line it continues as and its mark, one per line; nothing when it has none. */
export const TripNotes = ({ departure: dep, mark, className }: { departure: Departure; mark: TripMark | null; className?: string }) => {
    const { t } = useTranslation();
    const notice = dep.isCanceled ? null : feederNotice(dep.connections);
    const markLabel = mark ? TRIP_MARK_LABEL[mark] : null;
    if (!notice && !dep.continues_as && !markLabel) return null;
    return (
        <span className={cn("flex min-w-0 flex-col gap-1 text-xs leading-tight text-muted-foreground", className)}>
            {notice && <FeederNoticeText notice={notice} />}
            {dep.continues_as && (
                <span className="flex min-w-0 items-start gap-1.5">
                    <NoteIcon><CornerDownRight size={13} strokeWidth={1.75} className="-translate-y-0.5" /></NoteIcon>
                    <span className={NOTE_TEXT}>
                        <Trans
                            i18nKey="map.departures.continuesAs"
                            values={{ headsign: dep.continues_as.headsign }}
                            components={{ line: <NoteBadge name={dep.continues_as.line} color={dep.continues_as.route_color ?? ''} /> }}
                        />
                    </span>
                </span>
            )}
            {markLabel && <span className="micro-label text-primary">{t(markLabel)}</span>}
        </span>
    );
};

/** A note's icon, centred on the first line of its text; the turn arrow sits up a little as its stroke runs along its bottom. */
const NoteIcon = ({ children }: { children: React.ReactNode }) => (
    <span aria-hidden="true" className="flex h-5 shrink-0 items-center opacity-70">{children}</span>
);

/** A note's words and badges as running text, so a long phrase wraps word by word instead of dropping to its own line. */
const NOTE_TEXT = "min-w-0 leading-5";

/** A line named inside a note, as its badge, so "waits for 910" never reads as a count. */
const NoteBadge = ({ name, color }: { name: string; color: string }) => (
    <span className="mx-0.5 inline-flex align-middle">
        <LineBadge name={name} routeColor={color || FALLBACK_ROUTE_COLOR} size="md" />
    </span>
);

/** A feeder the departure waits for, is held by, or will not wait for, in words with its lines as badges. */
const FeederNoticeText = ({ notice }: { notice: FeederNotice }) => {
    const key = notice.kind === 'wontWait' ? 'map.departures.feeder.wontWait'
        : notice.kind === 'held' ? 'map.departures.feeder.heldFor'
        : 'map.departures.feeder.waitsForLines';
    const lines = <span className="inline-flex align-middle">{notice.lines.map(l => <NoteBadge key={l.name} name={l.name} color={l.color} />)}</span>;
    return (
        <span className={cn("flex min-w-0 items-start gap-1.5", notice.kind === 'wontWait' && "text-destructive")}>
            <NoteIcon><Hourglass size={13} strokeWidth={1.75} /></NoteIcon>
            <span className={NOTE_TEXT}>
                <Trans i18nKey={key} values={notice.kind === 'held' ? { minutes: notice.minutes } : {}} components={{ lines }} />
            </span>
        </span>
    );
};
