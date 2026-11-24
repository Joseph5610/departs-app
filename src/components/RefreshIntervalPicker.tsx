import { usePreferencesStore } from '@/state/preferencesStore';
import { REFRESH_INTERVAL_OPTIONS_S, type RefreshIntervalS } from '@/config/constants';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

/** How often live data refreshes, shared by Settings and the system status modal. */
export const RefreshIntervalPicker = () => {
    const refreshIntervalS = usePreferencesStore(s => s.refreshIntervalS);
    const setRefreshIntervalS = usePreferencesStore(s => s.actions.setRefreshIntervalS);

    return (
        <Tabs value={String(refreshIntervalS)} onValueChange={(v: string) => setRefreshIntervalS(Number(v) as RefreshIntervalS)}>
            <TabsList size="sm">
                {REFRESH_INTERVAL_OPTIONS_S.map(seconds => (
                    <TabsTrigger key={seconds} value={String(seconds)} data-testid={`refresh-interval-${seconds}`}>{seconds}s</TabsTrigger>
                ))}
            </TabsList>
        </Tabs>
    );
};
