import { useRideStore } from '@/state/rideStore';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useMemo } from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useVehicles } from '@/hooks/data/useVehicles';

type SystemStatusType = 'offline' | 'app_error' | 'upstream_offline' | 'stale' | 'refreshing' | 'healthy';

export interface SystemStatus {
    type: SystemStatusType;
    isOnline: boolean;
    isFetching: boolean;
    dataUpdatedAt: number;
}

/** Whole seconds until the next scheduled refresh, 0…intervalS; `now` (from useNow) may trail a just-arrived update. */
export const secondsUntilRefresh = (dataUpdatedAt: number, now: number, intervalS: number): number =>
    Math.max(0, intervalS - Math.max(0, Math.floor((now - dataUpdatedAt) / 1000)));

export const useSystemStatus = (): SystemStatus => {
    const isOnline = useNetworkStatus();
    const { vehicles, isFetching, isError, error, dataUpdatedAt } = useVehicles();

    return useMemo(() => {
        const feedStatus = vehicles?.status;
        const isStale = feedStatus === 'stale';
        const isUpstreamOffline = feedStatus === 'upstream_offline';

        let type: SystemStatusType = 'healthy';

        if (!isOnline) {
            type = 'offline';
        } else if (isError) {
            type = error?.isUpstream ? 'upstream_offline' : 'app_error';
        } else if (isUpstreamOffline) {
            type = 'upstream_offline';
        } else if (isStale) {
            type = 'stale';
        } else if (isFetching) {
            type = 'refreshing';
        }

        return {
            type,
            isOnline,
            isFetching,
            dataUpdatedAt
        };
    }, [isOnline, vehicles, isFetching, isError, error, dataUpdatedAt]);
};

/** Whether the live pill steps aside for the ride cards: a ride is shown and there is nothing to warn about. */
export const useLiveStatusYieldsToRides = (): boolean => {
    const status = useSystemStatus();
    const hasRide = useRideStore(s => s.ride !== null || s.followed !== null);
    const isFiltered = usePreferencesStore(
        s => s.routeTypeFilter.length > 0 || s.delayFilter.length > 0 || s.stopTypeFilter.length > 0
    );
    return hasRide && !isFiltered && (status.type === 'healthy' || status.type === 'refreshing');
};
