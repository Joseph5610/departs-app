import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Footprints } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Item } from '@/components/ui/item';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { FilterChip } from '@/components/FilterChip';
import { JourneyRow } from '@/components/JourneyRow';
import { LineBadge } from '@/components/LineBadge';
import { MinutesUntil } from '@/components/MinutesUntil';
import { MY_TRIP_CONFIG } from '@/config/constants';
import { expectedDepartureMs, sheetSelection, tripFromSheet, type TripDraft } from '@/domain/rides';
import { useMyTripSheet } from '@/hooks/derived/useMyTripSheet';
import { useMyTripActions } from '@/hooks/features/useMyTripActions';
import { navigate } from '@/lib/history';
import { paths } from '@/lib/routes';
import { useSelectionStore } from '@/state/selectionStore';
import { useUiStore } from '@/state/uiStore';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { MyTripTarget } from '@/types';

/** My trip on desktop: "I'm taking this trip", from a stop (with an alert before it leaves) and/or to an exit (with an alert before it). Phones show it as a card in the sheet. */
export const MyTripSheet = memo(() => {
    const target = useUiStore(s => s.myTripTarget);
    const { closeMyTrip } = useUiStore(s => s.actions);
    const isMobile = useIsMobile();
    return (
        <Dialog open={!!target && !isMobile} onOpenChange={(open) => { if (!open) closeMyTrip(); }}>
            <DialogContent
                finalFocus={false}
               
                className="h-auto max-h-[85dvh] max-w-105 gap-4 p-5"
            >
                {target && <MyTripSheetBody key={target.tripId} target={target} onClose={closeMyTrip} />}
            </DialogContent>
        </Dialog>
    );
});

/** My trip as the phone's sheet card, replacing what the sheet showed. */
export const MyTripCardContent = () => {
    const target = useUiStore(s => s.myTripTarget);
    const { closeMyTrip } = useUiStore(s => s.actions);
    if (!target) return null;
    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-(--panel-gutter) pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] [--stop-list-max:24dvh]">
            <MyTripSheetBody key={target.tripId} target={target} onClose={closeMyTrip} inCard />
        </div>
    );
};

MyTripSheet.displayName = 'MyTripSheet';

type Section = 'board' | 'exit' | null;

/** The sheet edits a draft of the trip; nothing changes until the user saves it. `undefined` keeps the default. */
const MyTripSheetBody = ({ target, onClose, inCard = false }: { target: MyTripTarget; onClose: () => void; inCard?: boolean }) => {
    const { t } = useTranslation();
    const { detail, isLoading, boardings, openedAt, exits, isRunning, lastStop, existing } = useMyTripSheet(target);
    const { save, end } = useMyTripActions();
    const { setBoardingStop } = useSelectionStore(s => s.actions);
    const [open, setOpen] = useState<Section>(target.section ?? null);
    const [draft, setDraft] = useState<TripDraft>({});
    const [isChoosingBoard, setIsChoosingBoard] = useState(false);

    const line = detail?.route_short_name ?? '';
    const selection = sheetSelection({ draft, existing, openedAt, isRunning, boardings, exits });
    const { boarding, lead, exit, exits: exitsAfterBoard, boardings: boardsBeforeExit } = selection;
    const toggle = (section: Section) => setOpen(current => (current === section ? null : section));

    const pickBoarding = (sequence: number | null) => {
        setDraft(current => ({ ...current, board: sequence, lead: undefined }));
        setIsChoosingBoard(false);
        if (sequence === null) setOpen('exit');
    };

    const pickExit = (sequence: number | null) => {
        setDraft(current => ({ ...current, exit: sequence }));
        setOpen(null);
    };

    /** Picking the chosen lead again turns the alert off. */
    const pickLead = (minutes: number | null) => setDraft(current => ({ ...current, lead: minutes === lead ? null : minutes }));

    const saveTrip = () => {
        if (!lastStop) return;
        const trip = tripFromSheet({ target, existing, selection, draft, openedAt, lastStop });
        const saved = save(trip, line, trip.exitStopName ?? lastStop.stopName);
        if (saved) onClose();
    };

    const endTrip = () => {
        end(target.tripId);
        onClose();
    };

    const openTrip = () => {
        if (target.stopId) setBoardingStop(target.tripId, target.stopId);
        navigate(paths.trip(target.city, target.tripId, target.vehicleId));
        onClose();
    };

    const boardSummary = boarding
        ? (lead !== null ? t('myTrip.boardLead', { stop: boarding.stopName, count: lead }) : t('myTrip.boardAt', { stop: boarding.stopName, time: boarding.time }))
        : isLoading ? t('myTrip.loading') : t('myTrip.aboard');
    const boardMs = boarding ? expectedDepartureMs(boarding.scheduledMs, boarding.delaySecs) : null;
    const exitSummary = exit ? t('myTrip.exitAt', { stop: exit.stopName, time: exit.time }) : t('myTrip.toEnd', { stop: lastStop?.stopName ?? '' });

    return (
        <>
            {!inCard && (
                <DialogHeader className="flex-row items-center gap-3 pr-8 text-left">
                    {line && <LineBadge name={line} routeColor={detail?.route_color ?? ''} size="lg" />}
                    <div className="flex min-w-0 flex-col">
                        <DialogTitle className="truncate type-title">{detail?.trip_headsign ?? ''}</DialogTitle>
                        <DialogDescription className="type-meta">{existing ? t('myTrip.title') : t('myTrip.take')}</DialogDescription>
                    </div>
                </DialogHeader>
            )}
            {inCard && (
                <div className="flex shrink-0 items-start gap-3 px-1">
                    {line && <LineBadge name={line} routeColor={detail?.route_color ?? ''} size="lg" />}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="type-headsign text-foreground">{detail?.trip_headsign ?? ''}</span>
                        <span className="type-meta text-muted-foreground">
                            {boarding ? t('myTrip.fromStop', { stop: boarding.stopName, time: boarding.time ?? '' }) : isLoading ? t('myTrip.loading') : t('myTrip.onBoard')}
                        </span>
                    </div>
                    {boardMs !== null && <span className="shrink-0 type-headsign tabular-nums"><MinutesUntil timestamp={new Date(boardMs).toISOString()} /></span>}
                </div>
            )}

            <Card size="none" className="min-h-0 shrink overflow-y-auto overscroll-contain">
                <JourneyRow leg="board" kind="toggle" title={t('myTrip.boardTitle')} summary={boardSummary} isOpen={open === 'board'} onClick={() => toggle('board')} />
                {open === 'board' && (isChoosingBoard || !boarding ? (
                        <StopList
                            leading={isRunning ? { label: t('myTrip.aboard'), isSelected: !boarding, onPick: () => pickBoarding(null) } : null}
                            stops={boardsBeforeExit}
                            selected={boarding?.sequence ?? null}
                            onPick={pickBoarding}
                        />
                    ) : (
                        <div className="flex flex-col gap-2.5 px-4 py-3">
                            <span className="type-note text-muted-foreground">{t('myTrip.leadLabel')}</span>
                            {boarding.leads.length === 0 && boarding.walkLead === null ? (
                                <span className="type-note text-muted-foreground">{t('myTrip.tooLate')}</span>
                            ) : (
                                <div role="group" aria-label={t('myTrip.leadLabel')} className="flex flex-wrap gap-x-1.5 gap-y-2">
                                    <FilterChip label={t('myTrip.leadOff')} isActive={lead === null} onClick={() => pickLead(null)} />
                                    {boarding.walkLead !== null && (
                                        <FilterChip
                                            icon={Footprints}
                                            label={t('myTrip.walkOption', { count: boarding.walkLead })}
                                            isActive={lead === boarding.walkLead}
                                            onClick={() => pickLead(boarding.walkLead)}
                                        />
                                    )}
                                    {MY_TRIP_CONFIG.LEAD_MINUTES.filter(m => m !== boarding.walkLead).map(minutes => (
                                        <FilterChip
                                            key={minutes}
                                            label={t('myTrip.leadOption', { count: minutes })}
                                            isActive={lead === minutes}
                                            isDisabled={!boarding.leads.includes(minutes) && lead !== minutes}
                                            onClick={() => pickLead(minutes)}
                                        />
                                    ))}
                                </div>
                            )}
                            <Button variant="link" size="inline" onClick={() => setIsChoosingBoard(true)} className="self-start">
                                {t('myTrip.changeStop')}
                            </Button>
                        </div>
                ))}
                <Separator className="ml-11.5 bg-sep data-horizontal:h-[0.5px] data-horizontal:w-auto" />
                <JourneyRow leg="exit" kind="toggle" title={t('myTrip.exitTitle')} summary={exitSummary} isOpen={open === 'exit'} onClick={() => toggle('exit')} />
                {open === 'exit' && (
                    <StopList
                        leading={{ label: t('myTrip.toEnd', { stop: lastStop?.stopName ?? '' }), isSelected: !exit, onPick: () => pickExit(null) }}
                        stops={exitsAfterBoard}
                        selected={exit?.sequence ?? null}
                        onPick={pickExit}
                    />
                )}
            </Card>

            <div className="flex shrink-0 flex-col items-center gap-1 pt-1">
                <Button size="lg" onClick={saveTrip} disabled={!lastStop} className="w-full" data-testid="my-trip-save">{existing ? t('myTrip.save') : t('myTrip.take')}</Button>
                {existing
                    ? <Button variant="link" size="inline" onClick={endTrip} className="h-control-lg text-tint-red">{t('myTrip.end')}</Button>
                    : <Button variant="link" size="inline" onClick={openTrip} className="h-control-lg">{t('myTrip.showTrip')}</Button>}
            </div>
        </>
    );
};

/** The stops a section picks from, with their times, after a leading choice if any (aboard already, to the end); the picked one checked. */
const StopList = ({ leading, stops, selected, onPick }: {
    leading: { label: string; isSelected: boolean; onPick: () => void } | null;
    stops: { sequence: number; stopName: string; time: string | null }[];
    selected: number | null;
    onPick: (sequence: number) => void;
}) => (
    <div className="max-h-(--stop-list-max,32dvh) overflow-y-auto overscroll-contain">
        <ul className="flex flex-col py-1">
            {leading && (
                <li>
                    <StopChoice label={leading.label} time={null} isSelected={leading.isSelected} onClick={leading.onPick} isMuted />
                </li>
            )}
            {stops.map(stop => (
                <li key={stop.sequence}>
                    <StopChoice label={stop.stopName} time={stop.time} isSelected={stop.sequence === selected} onClick={() => onPick(stop.sequence)} />
                </li>
            ))}
        </ul>
    </div>
);

const StopChoice = ({ label, time, isSelected, onClick, isMuted = false }: { label: string; time: string | null; isSelected: boolean; onClick: () => void; isMuted?: boolean }) => (
    <Item
        variant="row"
        size="none"
        render={<button type="button" onClick={onClick} aria-pressed={isSelected} />}
        className="gap-2 type-row aria-pressed:font-semibold aria-pressed:text-tint-mint"
    >
        <span className={cn("min-w-0 flex-1 truncate", isMuted && !isSelected && "text-muted-foreground")}>{label}</span>
        {isSelected && <Check size={15} strokeWidth={2.25} className="shrink-0" />}
        {time && <span className="shrink-0 type-note tabular-nums text-muted-foreground">{time}</span>}
    </Item>
);
