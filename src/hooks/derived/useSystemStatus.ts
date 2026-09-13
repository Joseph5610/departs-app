import { useMemo } from 'react';
import { useNetworkStatus } from '../features/useNetworkStatus';
import { useVehicles } from '../data/useVehicles';
import type { AppError } from '../../types/error';
import { TRANSIT_REFRESH_S } from '../../config/constants';

type SystemStatusType = 'offline' | 'app_error' | 'upstream_offline' | 'stale' | 'refreshing' | 'healthy';

export interface SystemStatus {
    type: SystemStatusType;
    isOnline: boolean;
    isFetching: boolean;
    isError: boolean;
    error: AppError | null;
    dataUpdatedAt: number;
}

/** Whole seconds until the next scheduled refresh, 0…TRANSIT_REFRESH_S; `now` (from useNow) may trail a just-arrived update. */
export const secondsUntilRefresh = (dataUpdatedAt: number, now: number): number =>
    Math.max(0, TRANSIT_REFRESH_S - Math.max(0, Math.floor((now - dataUpdatedAt) / 1000)));

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
            isError,
            error,
            dataUpdatedAt
        };
    }, [isOnline, vehicles, isFetching, isError, error, dataUpdatedAt]);
};
