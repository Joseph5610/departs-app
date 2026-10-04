import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRightLeft, ChevronDown, ChevronUp, CornerDownRight, type LucideIcon } from 'lucide-react';
import { navigate } from '../../../lib/history';
import { paths } from '../../../lib/routes';
import { cn } from 'cn';
import { addSecondsToTime } from '../../../utils/dateUtils';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { LineBadge } from '../../LineBadge';
import { usePreferencesStore } from '../../../state/preferencesStore';
import { TimelineTime } from './TimelineTime';
import type { Continuation, StopConnection } from '../../../types/vehicles';

/** A collapsible, labelled block under a stop listing trips a passenger can change to there. */
const StopTransferBlock = ({ icon: Icon, title, isPast, defaultOpen, preview, children }: {
    icon: LucideIcon,
    title: string,
    isPast: boolean,
    defaultOpen: boolean,
    /** Shown in the header while collapsed. */
    preview?: React.ReactNode,
    children: React.ReactNode
}) => {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <Collapsible
            open={open}
            onOpenChange={setOpen}
            className={cn(
                "mb-1 rounded-lg border border-border/50 bg-muted/40 px-2 py-1 transition-opacity duration-700",
                isPast ? "opacity-40" : "opacity-100"
            )}
        >
            <CollapsibleTrigger className="w-full flex items-center gap-1.5 px-1 py-0.5 micro-label text-muted-foreground cursor-pointer rounded-md outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring">
                <Icon size={12} strokeWidth={2} className="shrink-0" />
                <span className="shrink-0">{title}</span>
                <span className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
                    {!open && preview}
                </span>
                {open ? <ChevronUp size={14} strokeWidth={1.5} className="shrink-0" /> : <ChevronDown size={14} strokeWidth={1.5} className="shrink-0" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
                <ul aria-label={title} className="flex flex-col">
                    {children}
                </ul>
            </CollapsibleContent>
        </Collapsible>
    );
};

/** One onward trip; opens it when its trip id is known. */
const ConnectionRow = ({ tripId, vehicleId, line, routeColor, headsign, time, delay, note, isWarning }: {
    tripId?: string,
    vehicleId?: string,
    line: string,
    routeColor?: string,
    headsign: string,
    time?: string,
    delay?: number | null,
    note?: string,
    isWarning?: boolean
}) => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);

    const hasRealtime = !!time && typeof delay === 'number' && delay !== 0;
    const realtimeTime = hasRealtime ? addSecondsToTime(time as string, delay as number) : time;

    const content = (
        <>
            <LineBadge name={line} routeColor={routeColor ?? ''} size="lg" />
            <span className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium truncate">{headsign}</span>
                {note && (
                    <span className={cn(
                        "text-[10px] leading-tight",
                        isWarning ? "text-destructive font-semibold" : "text-muted-foreground"
                    )}>
                        {note}
                    </span>
                )}
            </span>
            {time && <TimelineTime realtimeTime={realtimeTime} scheduledTime={time} hasRealtime={hasRealtime} />}
        </>
    );
    const rowClass = "w-full flex items-center gap-2 px-1 py-1.5 text-left rounded-md";

    return (
        <li>
            {tripId ? (
                <button
                    type="button"
                    onClick={() => navigate(paths.trip(selectedCity, tripId, vehicleId))}
                    className={cn(rowClass, "cursor-pointer hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring")}
                >
                    {content}
                </button>
            ) : (
                <div className={rowClass}>{content}</div>
            )}
        </li>
    );
};

/** Onward trips that wait at this stop for the viewed trip. */
export const StopConnections = React.memo(({ connections, isPast, defaultOpen }: {
    connections: StopConnection[],
    isPast: boolean,
    defaultOpen: boolean
}) => {
    const { t } = useTranslation();

    const previewLines = useMemo(() => {
        const byName = new Map<string, string>();
        for (const c of connections) if (!byName.has(c.line)) byName.set(c.line, c.route_color ?? '');
        return [...byName];
    }, [connections]);

    const preview = previewLines.map(([line, color]) => (
        <LineBadge key={line} name={line} routeColor={color} size="sm" />
    ));

    return (
        <StopTransferBlock
            icon={ArrowRightLeft}
            title={t('map.vehicleDetails.connections.title')}
            isPast={isPast}
            defaultOpen={defaultOpen}
            preview={preview}
        >
            {connections.map((c) => {
                const showRisk = c.at_risk && !isPast;
                return (
                    <ConnectionRow
                        key={c.trip_id}
                        tripId={c.trip_id}
                        vehicleId={c.vehicle_id}
                        line={c.line}
                        routeColor={c.route_color}
                        headsign={c.headsign}
                        time={c.departure_time}
                        delay={c.delay}
                        note={showRisk
                            ? t('map.vehicleDetails.connections.mayNotWait')
                            : t('map.vehicleDetails.connections.waitsUpTo', { minutes: Math.round(c.max_wait_s / 60) })}
                        isWarning={showRisk}
                    />
                );
            })}
        </StopTransferBlock>
    );
});

StopConnections.displayName = 'StopConnections';

/** The trip the vehicle continues as after its last stop. */
export const StopContinuation = React.memo(({ continuation, isPast }: {
    continuation: Continuation,
    isPast: boolean
}) => {
    const { t } = useTranslation();

    return (
        <StopTransferBlock icon={CornerDownRight} title={t('map.vehicleDetails.continuesAs')} isPast={isPast} defaultOpen>
            <ConnectionRow
                tripId={continuation.trip_id}
                vehicleId={continuation.vehicle_id}
                line={continuation.line}
                routeColor={continuation.route_color}
                headsign={continuation.headsign}
                time={continuation.departure_time}
            />
        </StopTransferBlock>
    );
});

StopContinuation.displayName = 'StopContinuation';
