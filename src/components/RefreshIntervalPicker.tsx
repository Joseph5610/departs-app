import { SegmentedControl } from '@/components/SegmentedControl';
import { usePreferencesStore } from '@/state/preferencesStore';
import { REFRESH_INTERVAL_OPTIONS_S, type RefreshIntervalS } from '@/config/constants';

const OPTIONS = REFRESH_INTERVAL_OPTIONS_S.map(seconds => ({ value: String(seconds), label: `${seconds}s`, testId: `refresh-interval-${seconds}` }));

/** Segmented picker for how often live data refreshes, shared by Settings and the system status modal. */
export const RefreshIntervalPicker = () => {
    const refreshIntervalS = usePreferencesStore(s => s.refreshIntervalS);
    const setRefreshIntervalS = usePreferencesStore(s => s.actions.setRefreshIntervalS);

    return (
        <SegmentedControl
            size="sm"
            value={String(refreshIntervalS)}
            onChange={(v) => setRefreshIntervalS(Number(v) as RefreshIntervalS)}
            options={OPTIONS}
        />
    );
};
