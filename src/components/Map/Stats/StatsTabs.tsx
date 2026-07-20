import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePreferencesStore } from '../../../state/preferencesStore';
import { cn } from '@/lib/utils';

export const StatsTabs: React.FC = () => {
    const { t } = useTranslation();
    const tab = usePreferencesStore(s => s.statsTab);
    const setTab = usePreferencesStore(s => s.actions.setStatsTab);

    return (
        <div className="flex p-1 bg-black/5 dark:bg-white/10 rounded-xl mt-2 mx-6">
            <button
                onClick={() => setTab('screen')}
                className={cn(
                    "flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors",
                    tab === 'screen' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
            >
                {t('stats.onScreen')}
            </button>
            <button
                onClick={() => setTab('network')}
                className={cn(
                    "flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors",
                    tab === 'network' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
            >
                {t('stats.network')}
            </button>
        </div>
    );
};
