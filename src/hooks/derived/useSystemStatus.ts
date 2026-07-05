import { useMemo } from 'react';
import { useNetworkStatus } from '../features/useNetworkStatus';
import { useVehicles } from '../data/useVehicles';
import type { AppError } from '../../types/error';

export type SystemStatusType = 'offline' | 'app_error' | 'upstream_offline' | 'stale' | 'refreshing' | 'healthy';

export interface SystemStatus {
    type: SystemStatusType;
    isOnline: boolean;
    isFetching: boolean;
    isError: boolean;
    error: AppError | null;
    dataUpdatedAt: number;
}

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
