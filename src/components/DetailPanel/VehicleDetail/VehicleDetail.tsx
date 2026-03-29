
import React, { useMemo, useState } from 'react';
import { useGlobalAlerts } from '../../../hooks/data/useGlobalAlerts';
import { parseISO } from 'date-fns';
import { GenericAlertCard } from '../../Alerts/GenericAlertCard';
import { Stack } from '@/components/ui/layout';
import { VehicleDetailSkeleton } from './VehicleDetailSkeleton';
import { VehicleHero } from './VehicleHero';
import { StopTimeline } from './StopTimeline';

import type { VehicleDetail as VehicleDetailType } from '../../../types/transit';
import type { DisplayVehicle } from './types';

interface VehicleDetailProps {
    selectedVehicle: VehicleDetailType | null;
    vehicleDetail: VehicleDetailType | null;
    loadingDetail: boolean;
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
    isFollowing,
    onToggleFollow
}) => {
    const { rss } = useGlobalAlerts();
    const rssData = rss.data;
    const [liveDataAgeSeconds, setLiveDataAgeSeconds] = useState<number | null>(null);

    const displayVehicle = useMemo<DisplayVehicle | null>(() => {
        if (!selectedVehicle) return null;
        // Merge strategy: prioritize API detail but never let it override critical state with null/empty
        const mergedProperties = {
            ...selectedVehicle.properties,
            ...vehicleDetail?.properties,
            route_short_name: vehicleDetail?.properties?.route_short_name || selectedVehicle.properties.route_short_name,
            route_type: vehicleDetail?.properties?.route_type ?? selectedVehicle.properties.route_type,
            trip_headsign: vehicleDetail?.properties?.trip_headsign || selectedVehicle.properties.trip_headsign
        };
        const routeName = String(mergedProperties.route_short_name || '');
        const isStaticFallback = !!mergedProperties.is_static_fallback;

        // Effective sequence: suppress highlight if static fallback
        const rawSeq = mergedProperties.last_stop_sequence;
        const effectiveSequence = (isStaticFallback || rawSeq === null || rawSeq === undefined) ? null : Number(rawSeq);

        return {
            ...mergedProperties,
            routeName,
            isStaticFallback,
            effectiveSequence,
            routeType: mergedProperties.route_type ?? 0
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

    return (
        <Stack gap={4}>
            {/* Loading State */}
            {loadingDetail && !vehicleDetail && (
                <VehicleDetailSkeleton />
            )}

            {/* Header Hero Section (badge, delay, metadata, warning banners) */}
            <VehicleHero
                displayVehicle={displayVehicle}
                isFollowing={isFollowing}
                onToggleFollow={onToggleFollow}
                liveDataAgeSeconds={liveDataAgeSeconds}
            />

            {/* Alerts */}
            {relevantAlerts.length > 0 && (
                <Stack gap={2}>
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
                </Stack>
            )}

            {/* Schedule / Stop List */}
            {displayVehicle.stop_times?.features && displayVehicle.stop_times.features.length > 0 && (
                <StopTimeline
                    stopTimes={displayVehicle.stop_times.features}
                    effectiveSequence={displayVehicle.effectiveSequence}
                />
            )}
        </Stack>
    );
});

VehicleDetail.displayName = 'VehicleDetail';
