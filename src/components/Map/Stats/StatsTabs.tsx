import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePreferencesStore } from '../../../state/preferencesStore';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const StatsTabs: React.FC = () => {
    const { t } = useTranslation();
    const tab = usePreferencesStore(s => s.statsTab);
    const setTab = usePreferencesStore(s => s.actions.setStatsTab);

    return (
        <div className="pt-1 pb-3 px-6 shrink-0">
            <Tabs value={tab} onValueChange={(v) => setTab(v as 'screen' | 'network')}>
                <TabsList variant="pill" className="w-full grid grid-cols-2">
                    <TabsTrigger value="screen" className="cursor-pointer">
                        {t('stats.onScreen')}
                    </TabsTrigger>
                    <TabsTrigger value="network" className="cursor-pointer">
                        {t('stats.network')}
                    </TabsTrigger>
                </TabsList>
            </Tabs>
        </div>
    );
};

StatsTabs.displayName = 'StatsTabs';
