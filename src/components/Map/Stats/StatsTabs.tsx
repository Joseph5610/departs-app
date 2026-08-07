import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePreferencesStore } from '../../../state/preferencesStore';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Bus } from 'lucide-react';

export const StatsTabs: React.FC = () => {
    const { t } = useTranslation();
    const viewMode = usePreferencesStore(s => s.statsViewMode);
    const setViewMode = usePreferencesStore(s => s.actions.setStatsViewMode);

    return (
        <div className="pt-1 pb-2 px-4 shrink-0">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'overview' | 'vehicles')}>
                <TabsList variant="pill" className="w-full grid grid-cols-2">
                    <TabsTrigger value="overview" className="cursor-pointer gap-1.5 text-xs font-semibold">
                        <BarChart3 size={14} />
                        <span>{t('stats.monitor.overview', 'Přehled')}</span>
                    </TabsTrigger>
                    <TabsTrigger value="vehicles" className="cursor-pointer gap-1.5 text-xs font-semibold">
                        <Bus size={14} />
                        <span>{t('stats.monitor.vehicles', 'Seznam vozidel')}</span>
                    </TabsTrigger>
                </TabsList>
            </Tabs>
        </div>
    );
};

StatsTabs.displayName = 'StatsTabs';
