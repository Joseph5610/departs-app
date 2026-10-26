import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Footprints } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { JourneyRow } from '@/components/JourneyRow';
import { LineBadge } from '@/components/LineBadge';
import { MY_TRIP_CONFIG } from '@/config/constants';
import { sheetSelection, tripFromSheet, type TripDraft } from '@/domain/rides';
import { useMyTripSheet } from '@/hooks/derived/useMyTripSheet';
import { useMyTripActions } from '@/hooks/features/useMyTripActions';
import { navigate } from '@/lib/history';
import { paths } from '@/lib/routes';
import { useSelectionStore } from '@/state/selectionStore';
import { useUiStore } from '@/state/uiStore';
import type { MyTripTarget } from '@/types';

/** My trip: "I'm taking this trip", from a stop (with an alert before it leaves) and/or to an exit (with an alert before it). */
export const MyTripSheet = memo(() => {
    const target = useUiStore(s => s.myTripTarget);
    const { closeMyTrip } = useUiStore(s => s.actions);
    return (
        <Dialog open={!!target} onOpenChange={(open) => { if (!open) closeMyTrip(); }}>
            <DialogContent
                phoneLayout="sheet"
                finalFocus={false}
                className="h-auto max-h-[85dvh] max-w-105 gap-4 p-5 max-md:pt-6 max-md:pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]"
            >
                {target && <MyTripSheetBody key={target.tripId} target={target} onClose={closeMyTrip} />}
            </DialogContent>
        </Dialog>
    );
});

MyTripSheet.displayName = 'MyTripSheet';

type Section = 'board' | 'exit' | null;

const LEAD_OFF = 'off';

/** The sheet edits a draft of the trip; nothing changes until the user saves it. `undefined` keeps the default. */
const MyTripSheetBody = ({ target, onClose }: { target: MyTripTarget; onClose: () => void }) => {
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
    const exitSummary = exit ? t('myTrip.exitAt', { stop: exit.stopName, time: exit.time }) : t('myTrip.toEnd', { stop: lastStop?.stopName ?? '' });

    return (
        <>
            <DialogHeader className="flex-row items-center gap-3 pr-8 text-left">
                {line && <LineBadge name={line} routeColor={detail?.route_color ?? ''} size="lg" />}
                <div className="flex min-w-0 flex-col">
                    <DialogTitle className="truncate text-base font-bold">{detail?.trip_headsign ?? ''}</DialogTitle>
                    <DialogDescription className="text-xs">{existing ? t('myTrip.title') : t('myTrip.take')}</DialogDescription>
                </div>
            </DialogHeader>

            <Card variant="inset" size="none" className="min-h-0 overflow-hidden">
                <JourneyRow leg="board" kind="toggle" title={t('myTrip.boardTitle')} summary={boardSummary} isOpen={open === 'board'} onClick={() => toggle('board')} />
                {open === 'board' && (
                    <div className="border-t border-border/50">
                        {isChoosingBoard || !boarding ? (
                            <StopList
                                leading={isRunning ? { label: t('myTrip.aboard'), isSelected: !boarding, onPick: () => pickBoarding(null) } : null}
                                stops={boardsBeforeExit}
                                selected={boarding?.sequence ?? null}
                                onPick={pickBoarding}
                            />
                        ) : (
                            <div className="flex flex-col gap-2.5 px-4 py-3">
                                <span className="text-xs text-muted-foreground">{t('myTrip.leadLabel')}</span>
                                {boarding.leads.length === 0 && boarding.walkLead === null ? (
                                    <span className="text-xs text-muted-foreground">{t('myTrip.tooLate')}</span>
                                ) : (
                                    <ToggleGroup
                                        value={[lead === null ? LEAD_OFF : String(lead)]}
                                        onValueChange={(value: string[]) => setDraft(current => ({ ...current, lead: value.length && value[0] !== LEAD_OFF ? Number(value[0]) : null }))}
                                        variant="choice"
                                        size="sm"
                                        spacing={1.5}
                                        className="flex-wrap"
                                        aria-label={t('myTrip.leadLabel')}
                                    >
                                        <ToggleGroupItem value={LEAD_OFF} className="text-xs">
                                            {t('myTrip.leadOff')}
                                        </ToggleGroupItem>
                                        {boarding.walkLead !== null && (
                                            <ToggleGroupItem value={String(boarding.walkLead)} className="gap-1 text-xs tabular-nums">
                                                <Footprints size={14} strokeWidth={1.75} />
                                                {t('myTrip.walkOption', { count: boarding.walkLead })}
                                            </ToggleGroupItem>
                                        )}
                                        {MY_TRIP_CONFIG.LEAD_MINUTES.filter(m => m !== boarding.walkLead).map(minutes => (
                                            <ToggleGroupItem
                                                key={minutes}
                                                value={String(minutes)}
                                                disabled={!boarding.leads.includes(minutes) && lead !== minutes}
                                                className="text-xs tabular-nums"
                                            >
                                                {t('myTrip.leadOption', { count: minutes })}
                                            </ToggleGroupItem>
                                        ))}
                                    </ToggleGroup>
                                )}
                                <Button variant="link" size="sm" onClick={() => setIsChoosingBoard(true)} className="h-auto self-start p-0 text-xs">
                                    {t('myTrip.changeStop')}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
                <Separator />
                <JourneyRow leg="exit" kind="toggle" title={t('myTrip.exitTitle')} summary={exitSummary} isOpen={open === 'exit'} onClick={() => toggle('exit')} />
                {open === 'exit' && (
                    <div className="border-t border-border/50">
                        <StopList
                            leading={{ label: t('myTrip.toEnd', { stop: lastStop?.stopName ?? '' }), isSelected: !exit, onPick: () => pickExit(null) }}
                            stops={exitsAfterBoard}
                            selected={exit?.sequence ?? null}
                            onPick={pickExit}
                        />
                    </div>
                )}
            </Card>

            <div className="grid grid-cols-2 gap-2">
                {existing
                    ? <Button variant="secondary" onClick={endTrip}>{t('myTrip.end')}</Button>
                    : <Button variant="secondary" onClick={openTrip}>{t('myTrip.showTrip')}</Button>}
                <Button onClick={saveTrip} disabled={!lastStop} data-testid="my-trip-save">{existing ? t('myTrip.save') : t('myTrip.take')}</Button>
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
    <div className="max-h-[32dvh] overflow-y-auto overscroll-contain">
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
    <button
        type="button"
        onClick={onClick}
        aria-pressed={isSelected}
        className="flex min-h-10 w-full cursor-pointer items-center gap-2 px-4 text-left text-sm outline-none hover:bg-foreground/5 focus-visible:bg-foreground/5 aria-pressed:font-semibold aria-pressed:text-primary"
    >
        <span className={cn("min-w-0 flex-1 truncate", isMuted && !isSelected && "text-muted-foreground")}>{label}</span>
        {isSelected && <Check size={15} strokeWidth={2.25} className="shrink-0" />}
        {time && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{time}</span>}
    </button>
);
