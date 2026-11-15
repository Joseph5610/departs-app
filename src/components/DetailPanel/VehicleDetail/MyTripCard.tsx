import { useTranslation } from 'react-i18next';
import { Route } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { JourneyRow, type JourneyLeg } from '@/components/JourneyRow';
import type { MyTrip } from '@/types';
import { SectionHeading } from '@/components/SectionHeading';
import { CloseIcon } from '@/components/CloseIcon';

interface MyTripCardProps {
    /** The user's trip on this trip, if they take it. */
    trip: MyTrip | null;
    /** The picked exit's progress; null for a trip ridden to its end. */
    exit: { stopName: string; stopsLeft: number | null; arrivalTime: string | null } | null;
    lastStopName: string;
    /** Opens the My trip sheet, on a section when given. */
    onOpen: (section?: JourneyLeg) => void;
    onEnd: () => void;
}

/** My trip on the trip's page: the offer to take it, or its boarding and exit, each opening the sheet on its section. */
export const MyTripCard = ({ trip, exit, lastStopName, onOpen, onEnd }: MyTripCardProps) => {
    const { t } = useTranslation();

    if (!trip) {
        return (
            <Button className="w-full gap-1.75" onClick={() => onOpen()}>
                <Route size={16} strokeWidth={2.25} />
                {t('myTrip.take')}
            </Button>
        );
    }

    const board = trip.board;
    const exitMeta = exit?.arrivalTime ? `${t('ride.arrivesAtLabel')} ${exit.arrivalTime}` : '';

    return (
        <Card size="none" className="overflow-hidden" data-testid="my-trip-card">
            <div className="flex h-10 items-center justify-between gap-2 pl-4 pr-2.5">
                <SectionHeading className="px-0">{t('myTrip.title')}</SectionHeading>
                <Button variant="secondary" size="icon-xs" onClick={onEnd} aria-label={t('myTrip.end')} title={t('myTrip.end')} className="text-muted-foreground hover:text-foreground">
                    <CloseIcon />
                </Button>
            </div>
            <JourneyRow
                leg="board"
                kind="open"
                density="compact"
                title={board ? board.stopName : t('myTrip.aboard')}
                summary={board ? (board.leadMin !== null ? t('myTrip.leadShort', { count: board.leadMin }) : t('myTrip.noAlertShort')) : t('myTrip.boardTitle')}
                onClick={() => onOpen('board')}
            />
            <JourneyRow
                leg="exit"
                kind="open"
                density="compact"
                title={trip.toEnd ? lastStopName : exit?.stopName ?? trip.exitStopName ?? ''}
                summary={trip.toEnd ? t('myTrip.terminus') : exitMeta || t('myTrip.exitTitle')}
                onClick={() => onOpen('exit')}
            />
        </Card>
    );
};
