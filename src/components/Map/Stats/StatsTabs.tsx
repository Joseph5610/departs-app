import { useTranslation } from 'react-i18next';
import { usePreferencesStore } from '@/state/preferencesStore';
import { PanelTabs } from '@/components/PanelTabs';
import { BarChart3, Bus } from 'lucide-react';

export const StatsTabs = () => {
    const { t } = useTranslation();
    const viewMode = usePreferencesStore(s => s.statsViewMode);
    const setViewMode = usePreferencesStore(s => s.actions.setStatsViewMode);

    return (
        <PanelTabs
            value={viewMode}
            onChange={setViewMode}
            tabs={[
                { value: 'overview', icon: <BarChart3 size={14} />, label: t('stats.monitor.overview') },
                { value: 'vehicles', icon: <Bus size={14} />, label: t('stats.monitor.vehicles') },
            ]}
        />
    );
};
