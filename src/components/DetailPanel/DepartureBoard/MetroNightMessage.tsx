import { useTranslation } from 'react-i18next';
import { MoonStar } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';

/**
 * MetroNightMessage
 *
 * Displays a friendly message when a metro station is visited during night hours
 * and no departures are scheduled.
 */
export const MetroNightMessage = () => {
    const { t } = useTranslation();

    return (
        <EmptyState
            icon={MoonStar}
            title={t('map.departures.metroNight.title')}
            description={t('map.departures.metroNight.description')}
            className="flex-none justify-start"
        />
    );
};
