import { useTranslation } from 'react-i18next';
import { MoonStar } from 'lucide-react';
import {
    Empty,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
    EmptyDescription,
} from '@/components/ui/empty';

/**
 * MetroNightMessage
 *
 * Displays a friendly message when a metro station is visited during night hours
 * and no departures are scheduled.
 */
export const MetroNightMessage = () => {
    const { t } = useTranslation();

    return (
        <Empty className="flex-none justify-start py-12 animate-in fade-in duration-500">
            <EmptyHeader>
                <EmptyMedia
                    variant="tile" className="bg-fill text-muted-foreground"
                >
                    <MoonStar strokeWidth={1.5} />
                </EmptyMedia>
                <EmptyTitle className="type-headsign text-foreground/90">
                    {t('map.departures.metroNight.title')}
                </EmptyTitle>
                <EmptyDescription className="type-meta max-w-70">
                    {t('map.departures.metroNight.description')}
                </EmptyDescription>
            </EmptyHeader>
        </Empty>
    );
};
