import React from 'react';
import { useTranslation } from 'react-i18next';
import { MoonStar } from 'lucide-react';
import {
    Empty,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
    EmptyDescription,
} from '../../ui/empty';

/**
 * MetroNightMessage
 *
 * Displays a friendly message when a metro station is visited during night hours
 * and no departures are scheduled.
 */
export const MetroNightMessage: React.FC = () => {
    const { t } = useTranslation();

    return (
        <Empty className="flex-none justify-start py-12 border-none animate-in fade-in duration-500">
            <EmptyHeader>
                <EmptyMedia
                    variant="icon"
                    className="size-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.1)] [&_svg:not([class*='size-'])]:size-7"
                >
                    <MoonStar strokeWidth={1.5} />
                </EmptyMedia>
                <EmptyTitle className="text-base font-bold text-foreground/90">
                    {t('map.departures.metroNight.title')}
                </EmptyTitle>
                <EmptyDescription className="text-[13px] max-w-[280px]">
                    {t('map.departures.metroNight.description')}
                </EmptyDescription>
            </EmptyHeader>
        </Empty>
    );
};

MetroNightMessage.displayName = 'MetroNightMessage';
