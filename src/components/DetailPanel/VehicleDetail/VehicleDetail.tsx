
import React, { useMemo, useState } from 'react';
import { useGlobalAlerts } from '../../../hooks/data/useGlobalAlerts';
import { parseISO } from 'date-fns';
import { GenericAlertCard } from '../../Alerts/GenericAlertCard';

import { VehicleDetailSkeleton } from './VehicleDetailSkeleton';
import { VehicleHero } from './VehicleHero';
import { StopTimeline } from './StopTimeline';

import type { VehicleDetail as VehicleDetailType } from '../../../types/transit';
import type { DisplayVehicle } from './types';

import { ErrorState } from '@/components/DetailPanel/ErrorState';
import type { AppError } from '../../../types/error';

interface VehicleDetailProps {
    selectedVehicle: VehicleDetailType | null;
    vehicleDetail: VehicleDetailType | null;
    loadingDetail: boolean;
    isError?: boolean;
    error?: AppError | null;
    onRetry?: () => void;
    isFollowing: boolean;
    onToggleFollow: () => void;
}

/**
 * VehicleDetail
 *
 * Container component that composes VehicleHero and StopTimeline.
 * Manages vehicle data merging, live data age tracking, and alert filtering.
 * The visual rendering is delegated to focused sub-components.
 */
export const VehicleDetail = React.memo<VehicleDetailProps>(({
    selectedVehicle,
    vehicleDetail,
    loadingDetail,
    isError,
    error,
    onRetry,
    isFollowing,
    onToggleFollow
}) => {
    const { rss } = useGlobalAlerts();
    const rssData = rss.data;
    const [liveDataAgeSeconds, setLiveDataAgeSeconds] = useState<number | null>(null);

    const displayVehicle = useMemo<DisplayVehicle | null>(() => {
        if (!selectedVehicle) return null;
        // Merge strategy: prioritize API detail but never let it override critical state with null/empty
        const merged = {
            ...selectedVehicle,
            ...vehicleDetail,
            route_short_name: vehicleDetail?.route_short_name || selectedVehicle.route_short_name,
            route_type: vehicleDetail?.route_type ?? selectedVehicle.route_type,
            trip_headsign: vehicleDetail?.trip_headsign || selectedVehicle.trip_headsign
        };
        const routeName = String(merged.route_short_name || '');
        const isStaticFallback = !!merged.is_static_fallback;

        // Effective sequence: suppress highlight if static fallback
        const rawSeq = merged.last_stop_sequence;
        const effectiveSequence = (isStaticFallback || rawSeq === null || rawSeq === undefined) ? null : Number(rawSeq);

        return {
            ...merged,
            routeName,
            isStaticFallback,
            effectiveSequence,
            routeType: merged.route_type ?? 0
        };
    }, [selectedVehicle, vehicleDetail]);

    React.useEffect(() => {
        const originTs = displayVehicle?.origin_timestamp;
        if (!originTs) {
            setLiveDataAgeSeconds(null);
            return;
        }

        const updateAge = () => {
            try {
                const tsString = String(originTs);
                const timestamp = parseISO(tsString);
                const now = new Date();
                const ageInSeconds = Math.floor((now.getTime() - timestamp.getTime()) / 1000);
                setLiveDataAgeSeconds(ageInSeconds);
            } catch {
                setLiveDataAgeSeconds(null);
            }
        };

        updateAge();
        const interval = setInterval(updateAge, 1000);
        return () => clearInterval(interval);
    }, [displayVehicle?.origin_timestamp]);

    const relevantAlerts = useMemo(() => {
        const allItems = rssData?.alerts || [];
        const routeName = displayVehicle?.routeName;
        if (!routeName) return [];
        const upperRouteName = routeName.toUpperCase();
        return allItems.filter(item =>
            item.lines?.some((l: string) => String(l).toUpperCase() === upperRouteName) &&
            item.isActive
        );
    }, [rssData, displayVehicle?.routeName]);

    if (!displayVehicle) return null;

    const hasBasicData = !!(displayVehicle.route_short_name || displayVehicle.trip_headsign);
    const showSkeleton = loadingDetail && !vehicleDetail && !isError && !hasBasicData;
    const showContent = hasBasicData && !showSkeleton && !isError;

    return (
        <div className="flex flex-col gap-4">
            {/* Loading State */}
            {showSkeleton && (
                <VehicleDetailSkeleton />
            )}

            {/* Error State */}
            {isError && !vehicleDetail && (
                <ErrorState error={error || null} onRetry={onRetry} />
            )}

            {/* Main Content */}
            {showContent && (
                <>
                    <VehicleHero
                        displayVehicle={displayVehicle}
                        isFollowing={isFollowing}
                        onToggleFollow={onToggleFollow}
                        liveDataAgeSeconds={liveDataAgeSeconds}
                    />

                    {/* Alerts */}
                    {relevantAlerts.length > 0 && (
                        <div className="flex flex-col gap-2">
                            {relevantAlerts.map((alert, idx) => (
                                <GenericAlertCard
                                    key={alert.guid || idx}
                                    title={alert.title}
                                    description={alert.description}
                                    link={alert.link}
                                    priority={alert.priority || 'normal'}
                                    validFrom={alert.valid_from}
                                    validTo={alert.valid_to}
                                    isActive={alert.isActive}
                                    isFuture={alert.isFuture}
                                />
                            ))}
                        </div>
                    )}

                    {/* Schedule / Stop List */}
                    {displayVehicle.stop_times?.features && displayVehicle.stop_times.features.length > 0 ? (
                        <StopTimeline
                            stopTimes={displayVehicle.stop_times.features}
                            effectiveSequence={displayVehicle.effectiveSequence}
                        />
                    ) : (
                        loadingDetail && <VehicleDetailSkeleton />
                    )}
                </>
            )}
        </div>
    );
});

VehicleDetail.displayName = 'VehicleDetail';
