import { useMemo, useState, memo } from 'react';
import { cn } from '@/lib/cn';
import { SectionHeading } from '@/components/SectionHeading';
import { useAlerts } from '@/hooks/data/useAlerts';
import { useTranslation } from 'react-i18next';
import { safeHexColor } from '@/lib/color';
import { useUiStore } from '@/state/uiStore';
import { useCityConfig } from '@/hooks/data/useCities';
import { pushChannelOf } from '@/domain/cities';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CondensedAlertItem } from '@/components/Alerts/CondensedAlertItem';
import { Card } from '@/components/ui/card';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { TRIP_CONFIG, VEHICLE_ALERTS, FALLBACK_ROUTE_COLOR } from '@/config/constants';
import { alertsForLine, isHighPriorityAlert } from '@/domain/alerts';
import type { RSSItem, VehicleDetail as VehicleDetailType, AppError } from '@/types';

import { VehicleDetailSkeleton, StopTimelineSkeleton } from './VehicleDetailSkeleton';
import { VehicleHero } from './VehicleHero';
import { StopTimeline } from './StopTimeline';

import type { DisplayVehicle } from './types';

import { ErrorState } from '@/components/DetailPanel/ErrorState';
import { isTripEnded } from '@/domain/vehicles';
import { useNowEvery } from '@/hooks/useNow';
import { liveStopSequence } from '@shared/rides';

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

/** The vehicle panel: hero, the line's alerts and the stop timeline, sharing one view of the vehicle and whether its trip has ended. */
export const VehicleDetail = memo<VehicleDetailProps>(({
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
    const { alerts } = useAlerts();
    const cityConfig = useCityConfig();

    // Already merged by useSelectedVehicle; spreading the detail over it again would overwrite push data.
    const displayVehicle = useMemo<DisplayVehicle | null>(() => selectedVehicle && {
        ...selectedVehicle,
        routeName: String(selectedVehicle.route_short_name || ''),
        isStaticFallback: !!selectedVehicle.is_static_fallback,
        effectiveSequence: liveStopSequence(selectedVehicle),
    }, [selectedVehicle]);

    const now = useNowEvery(TRIP_CONFIG.ENDED_CHECK_MS);
    const hasEnded = !!displayVehicle && isTripEnded(displayVehicle.stop_times?.features ?? [], displayVehicle.delay, displayVehicle.effectiveSequence, now, cityConfig.timezone);

    const routeName = displayVehicle?.routeName;
    const relevantAlerts = useMemo(
        () => (routeName && alerts ? alertsForLine(alerts, routeName) : []),
        [alerts, routeName],
    );

    if (!displayVehicle) return null;

    const hasBasicData = !!(displayVehicle.route_short_name || displayVehicle.trip_headsign);
    const showSkeleton = loadingDetail && !vehicleDetail && !isError && !hasBasicData;
    const showContent = hasBasicData && !showSkeleton && !isError;

    return (
        <div className="flex flex-col gap-4">
            {showSkeleton && (
                <VehicleDetailSkeleton />
            )}

            {isError && !vehicleDetail && (
                <ErrorState error={error || null} onRetry={onRetry} />
            )}

            {showContent && (
                <>
                    <VehicleHero
                        displayVehicle={displayVehicle}
                        hasEnded={hasEnded}
                        isFollowing={isFollowing}
                        onToggleFollow={onToggleFollow}
                        isDetailLoading={loadingDetail && !vehicleDetail}
                        hasEnrichment={!!pushChannelOf(cityConfig)}
                    />

                    {relevantAlerts.length > 0 && (
                        <div className="flex flex-col gap-2 mt-1">
                            <SectionHeading>
                                {t('alerts.title')}
                                {relevantAlerts.length > 1 && ` (${relevantAlerts.length})`}
                            </SectionHeading>
                            <LineAlertList alerts={relevantAlerts} />
                        </div>
                    )}

                    {displayVehicle.stop_times?.features && displayVehicle.stop_times.features.length > 0 ? (
                        <StopTimeline
                            stopTimes={displayVehicle.stop_times.features}
                            hasEnded={hasEnded}
                            routeName={displayVehicle.routeName}
                            routeColor={safeHexColor(displayVehicle.route_color) ?? FALLBACK_ROUTE_COLOR}
                            effectiveSequence={displayVehicle.effectiveSequence}
                            delay={displayVehicle.delay}
                            tripId={displayVehicle.gtfs_trip_id}
                            vehicleId={displayVehicle.vehicle_id ?? null}
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

const alertKey = (alert: RSSItem, idx: number) => alert.guid || `${alert.title}-${idx}`;

const LineAlertList = ({ alerts }: { alerts: RSSItem[] }) => {
    const { t } = useTranslation();
    const [showAll, setShowAll] = useState(false);
    const { openAlert } = useUiStore(s => s.actions);

    const previewCount = alerts.length - VEHICLE_ALERTS.PREVIEW_COUNT < VEHICLE_ALERTS.MIN_OVERFLOW
        ? alerts.length
        : VEHICLE_ALERTS.PREVIEW_COUNT;
    const preview = alerts.slice(0, previewCount);
    const overflow = alerts.slice(previewCount);

    const renderItem = (alert: RSSItem, idx: number) => {
        const guid = alert.guid;
        return (
            <CondensedAlertItem
                key={alertKey(alert, idx)}
                item={alert}
                compact
                onOpenFull={guid ? () => openAlert(guid) : undefined}
                className={cn(idx > 0 && "before:absolute before:top-0 before:right-0 before:left-11.5 before:h-[0.5px] before:bg-sep", isHighPriorityAlert(alert.priority) && "bg-tint-red/16")}
            />
        );
    };

    return (
        <Card size="none" className="overflow-hidden">
            <Collapsible open={showAll} onOpenChange={setShowAll}>
                {preview.map(renderItem)}
                {overflow.length > 0 && (
                    <>
                        <CollapsibleContent>
                            {overflow.map((alert, idx) => renderItem(alert, idx + previewCount))}
                        </CollapsibleContent>
                        <CollapsibleTrigger className="row-hover-group flex w-full items-center justify-center gap-1.5 px-3.5 py-3 type-meta text-muted-foreground hover:text-foreground">
                            {showAll ? t('alerts.showLess') : t('alerts.showMore', { count: overflow.length })}
                            {showAll ? <ChevronUp size={14} strokeWidth={1.5} /> : <ChevronDown size={14} strokeWidth={1.5} />}
                        </CollapsibleTrigger>
                    </>
                )}
            </Collapsible>
        </Card>
    );
};
