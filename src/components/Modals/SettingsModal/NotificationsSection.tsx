import { useTranslation } from 'react-i18next';
import { DisruptionPushToggle } from '@/components/Alerts/DisruptionPushToggle';
import { SectionHeading } from '@/components/SectionHeading';
import { useCityConfig } from '@/hooks/data/useCities';

/** Pushes of new disruptions on pinned lines, in cities with an alerts feed. */
export const NotificationsSection = () => {
    const { t } = useTranslation();
    const hasAlerts = Boolean(useCityConfig().hasAlerts);
    if (!hasAlerts) return null;

    return (
        <div className="flex flex-col gap-3">
            <SectionHeading>{t('settings.sections.notifications')}</SectionHeading>
            <DisruptionPushToggle />
        </div>
    );
};
