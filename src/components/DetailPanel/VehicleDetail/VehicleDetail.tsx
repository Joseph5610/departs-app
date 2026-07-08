
import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useGlobalAlerts } from '../../../hooks/data/useGlobalAlerts';
import { useTranslation } from 'react-i18next';
import { parseISO } from 'date-fns';
import { GenericAlertCard } from '../../Alerts/GenericAlertCard';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  useCarousel,
} from '@/components/ui/carousel';

import { VehicleDetailSkeleton, StopTimelineSkeleton } from './VehicleDetailSkeleton';
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
    const { t } = useTranslation();
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

        // Effective sequence: suppress highlight if static fallback or before_track
        const rawSeq = merged.last_stop_sequence;
        const isBeforeTrack = ['before_track', 'before_track_delayed'].includes(merged.state_position || '');
        const effectiveSequence = (isStaticFallback || isBeforeTrack || rawSeq === null || rawSeq === undefined) ? null : Number(rawSeq);

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
            const tId = setTimeout(() => setLiveDataAgeSeconds(null), 0);
            return () => clearTimeout(tId);
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
        return allItems.filter(item => {
            const matchesLine = item.lines?.some((l: string) => String(l).toUpperCase() === upperRouteName);
            const matchesMetadata = item.line_metadata?.some((m) => String(m.name).toUpperCase() === upperRouteName);
            return (matchesLine || matchesMetadata) && item.isActive;
        });
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
                        isDetailLoading={loadingDetail && !vehicleDetail}
                    />

                    {/* Alerts */}
                    {relevantAlerts.length > 0 && (
                        <div className="flex flex-col gap-2 mt-2">
                            <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest px-1">
                                {t('alerts.title', { defaultValue: 'Mimořádnosti a výluky' })}
                                {relevantAlerts.length > 1 && ` (${relevantAlerts.length})`}
                            </span>
                            <Carousel opts={{ loop: true }} className="w-full">
                                <CarouselContent className="-ml-3">
                                    {relevantAlerts.map((alert, idx) => (
                                        <CarouselItem key={alert.guid || idx} className="pl-3 basis-full">
                                            <GenericAlertCard
                                                title={alert.title}
                                                description={alert.description}
                                                link={alert.link}
                                                priority={alert.priority || 'normal'}
                                                validFrom={alert.valid_from}
                                                validTo={alert.valid_to}
                                                isActive={alert.isActive}
                                                isFuture={alert.isFuture}
                                                cause={alert.cause}
                                                causeDetail={alert.causeDetail}
                                                type={alert.type}
                                                effect={alert.effect}
                                                hideCauseText={true}
                                            />
                                        </CarouselItem>
                                    ))}
                                </CarouselContent>
                                <CarouselDots count={relevantAlerts.length} />
                            </Carousel>
                        </div>
                    )}

                    {/* Schedule / Stop List */}
                    {displayVehicle.stop_times?.features && displayVehicle.stop_times.features.length > 0 ? (
                        <StopTimeline
                            stopTimes={displayVehicle.stop_times.features}
                            effectiveSequence={displayVehicle.effectiveSequence}
                        />
                    ) : (
                        loadingDetail && <StopTimelineSkeleton />
                    )}
                </>
            )}
        </div>
    );
});

VehicleDetail.displayName = 'VehicleDetail';

const CarouselDots = ({ count }: { count: number }) => {
    const { api } = useCarousel();
    const [current, setCurrent] = React.useState(0);

    React.useEffect(() => {
        if (!api) return;
        const onSelect = () => setCurrent(api.selectedScrollSnap());
        api.on("select", onSelect);
        api.on("reInit", onSelect);
        const tId = setTimeout(onSelect, 0);
        return () => {
            api.off("select", onSelect);
            api.off("reInit", onSelect);
            clearTimeout(tId);
        };
    }, [api]);

    if (count <= 1) return null;

    return (
        <div className="flex justify-center items-center gap-1.5 mt-2 mb-1">
            {Array.from({ length: count }).map((_, idx) => (
                <div
                    key={idx}
                    className={cn(
                        "h-1.5 rounded-full transition-all duration-300",
                        current === idx ? "w-4 bg-primary" : "w-1.5 bg-foreground/20"
                    )}
                />
            ))}
        </div>
    );
};
