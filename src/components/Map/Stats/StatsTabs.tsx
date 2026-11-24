import { useTranslation } from 'react-i18next';
import { BarChart3, Bus } from 'lucide-react';
import { usePreferencesStore } from '@/state/preferencesStore';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

/** Switches the stats panel between the overview and the vehicle list. */
export const StatsTabs = () => {
    const { t } = useTranslation();
    const viewMode = usePreferencesStore(s => s.statsViewMode);
    const setViewMode = usePreferencesStore(s => s.actions.setStatsViewMode);

    return (
        <Tabs value={viewMode} onValueChange={setViewMode} className="shrink-0 px-(--panel-gutter) pb-2">
            <TabsList>
                <TabsTrigger value="overview"><BarChart3 size={14} />{t('stats.monitor.overview')}</TabsTrigger>
                <TabsTrigger value="vehicles"><Bus size={14} />{t('stats.monitor.vehicles')}</TabsTrigger>
            </TabsList>
        </Tabs>
    );
};
