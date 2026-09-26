import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePreferencesStore } from '../state/preferencesStore';
import { REFRESH_INTERVAL_OPTIONS_S, type RefreshIntervalS } from '../config/constants';

/** Segmented picker for how often live data refreshes, shared by Settings and the system status modal. */
export const RefreshIntervalPicker: React.FC<{ className?: string }> = ({ className }) => {
    const refreshIntervalS = usePreferencesStore(s => s.refreshIntervalS);
    const setRefreshIntervalS = usePreferencesStore(s => s.actions.setRefreshIntervalS);

    return (
        <Tabs value={String(refreshIntervalS)} onValueChange={(v) => setRefreshIntervalS(Number(v) as RefreshIntervalS)} className={className}>
            <TabsList variant="pill" className="w-full grid grid-cols-3">
                {REFRESH_INTERVAL_OPTIONS_S.map(seconds => (
                    <TabsTrigger
                        key={seconds}
                        value={String(seconds)}
                        data-testid={`refresh-interval-${seconds}`}
                        className="cursor-pointer text-xs font-semibold tabular-nums"
                    >
                        {seconds}s
                    </TabsTrigger>
                ))}
            </TabsList>
        </Tabs>
    );
};
