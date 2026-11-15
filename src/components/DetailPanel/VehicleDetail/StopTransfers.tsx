import React, { useState, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRightLeft, ChevronDown, ChevronUp, CornerDownRight, type LucideIcon } from 'lucide-react';
import { navigate } from '@/lib/history';
import { paths } from '@/lib/routes';
import { cn } from '@/lib/cn';
import { SectionHeading } from '@/components/SectionHeading';
import { TRIP_CONFIG } from '@/config/constants';
import { distinctLines } from '@/domain/departures';
import { lineLabel } from '@/domain/routes';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { LineBadge } from '@/components/LineBadge';
import { Card } from '@/components/ui/card';
import { Item } from '@/components/ui/item';
import { usePreferencesStore } from '@/state/preferencesStore';
import { TimelineTime } from './TimelineTime';
import type { Continuation, StopConnection } from '@/types';
import { addSecondsToTime } from '@shared/time';

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
        <Card size="none" className={cn("mb-2 transition-opacity duration-700", isPast && "opacity-40")}>
            <Collapsible open={open} onOpenChange={setOpen}>
                <CollapsibleTrigger className="row-hover-group flex h-9 w-full items-center gap-1.5 px-3.5 text-muted-foreground hover:text-foreground">
                    <Icon size={14} strokeWidth={1.75} className="shrink-0" />
                    <SectionHeading className="shrink-0 px-0 text-inherit">{title}</SectionHeading>
                    <span className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
                        {!open && preview}
                    </span>
                    {open ? <ChevronUp size={14} strokeWidth={1.5} className="shrink-0" /> : <ChevronDown size={14} strokeWidth={1.5} className="shrink-0" />}
                </CollapsibleTrigger>
                <CollapsibleContent aria-label={title}>
                    {children}
                </CollapsibleContent>
            </Collapsible>
        </Card>
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
                <span className="type-row truncate">{headsign}</span>
                {note && (
                    <span className={cn(
                        "type-note",
                        isWarning ? "text-destructive font-semibold" : "text-muted-foreground"
                    )}>
                        {note}
                    </span>
                )}
            </span>
            {time && <TimelineTime realtimeTime={realtimeTime} scheduledTime={time} hasRealtime={hasRealtime} />}
        </>
    );
    const row = "[--row-sep:3.625rem]";

    if (!tripId) return <Item variant="row" size="none" className={row}>{content}</Item>;
    return (
        <Item
            variant="row"
            size="none"
            render={<button type="button" onClick={() => navigate(paths.trip(selectedCity, tripId, vehicleId))} />}
            className={row}
        >
            {content}
        </Item>
    );
};

/** Onward trips that wait at this stop for the viewed trip. */
export const StopConnections = memo(({ connections, isPast, defaultOpen }: {
    connections: StopConnection[],
    isPast: boolean,
    defaultOpen: boolean
}) => {
    const { t } = useTranslation();

    const previewLines = useMemo(() => distinctLines(connections), [connections]);

    const hiddenLines = previewLines.length - TRIP_CONFIG.TRANSFER_PREVIEW_LINES;
    const preview = (
        <>
            {previewLines.slice(0, TRIP_CONFIG.TRANSFER_PREVIEW_LINES).map(([line, color]) => (
                <LineBadge key={line} name={line} routeColor={color} size="row" />
            ))}
            {hiddenLines > 0 && <span className="shrink-0 tabular-nums">+{hiddenLines}</span>}
        </>
    );

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
                        line={lineLabel(c)}
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
export const StopContinuation = memo(({ continuation, isPast }: {
    continuation: Continuation,
    isPast: boolean
}) => {
    const { t } = useTranslation();

    return (
        <StopTransferBlock
            icon={CornerDownRight}
            title={t('map.vehicleDetails.continuesAs')}
            isPast={isPast}
            defaultOpen
            preview={<LineBadge name={continuation.line} routeColor={continuation.route_color ?? ''} size="row" />}
        >
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
