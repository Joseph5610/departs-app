import { useMemo, useState, memo } from 'react';
import { cn } from 'cn';
import { useAlerts } from '@/hooks/data/useAlerts';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/state/uiStore';
import { useCityConfig } from '@/hooks/data/useCities';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CondensedAlertItem } from '@/components/Alerts/CondensedAlertItem';
import { Card } from '@/components/ui/card';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { TRIP_CONFIG, VEHICLE_ALERTS } from '@/config/constants';
import { alertsForLine, isHighPriorityAlert } from '@/domain/alerts';
import type { RSSItem, VehicleDetail as VehicleDetailType, AppError } from '@/types';

import { VehicleDetailSkeleton, StopTimelineSkeleton } from './VehicleDetailSkeleton';
import { VehicleHero } from './VehicleHero';
import { StopTimeline } from './StopTimeline';
import { TripEndedNotice } from './TripEndedNotice';

import type { DisplayVehicle } from './types';

import { ErrorState } from '@/components/DetailPanel/ErrorState';
import { isTripEnded, liveStopSequence } from '@/domain/vehicles';
import { useNowEvery } from '@/hooks/useNow';

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
                    <TripEndedNotice vehicle={displayVehicle} hasEnded={hasEnded} />
                    <VehicleHero
                        displayVehicle={displayVehicle}
                        hasEnded={hasEnded}
                        isFollowing={isFollowing}
                        onToggleFollow={onToggleFollow}
                        isDetailLoading={loadingDetail && !vehicleDetail}
                        hasEnrichment={!!cityConfig.enrichmentChannel}
                    />

                    {relevantAlerts.length > 0 && (
                        <div className="flex flex-col gap-3 mt-2">
                            <span className="micro-label-widest text-muted-foreground px-1">
                                {t('alerts.title')}
                                {relevantAlerts.length > 1 && ` (${relevantAlerts.length})`}
                            </span>
                            <LineAlertList alerts={relevantAlerts} />
                        </div>
                    )}

                    {displayVehicle.stop_times?.features && displayVehicle.stop_times.features.length > 0 ? (
                        <StopTimeline
                            stopTimes={displayVehicle.stop_times.features}
                            hasEnded={hasEnded}
                            routeName={displayVehicle.routeName}
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
                className={cn(idx > 0 && "border-t border-border/50", isHighPriorityAlert(alert.priority) && "bg-destructive/10")}
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
                        <CollapsibleTrigger className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 border-t border-border/50 micro-label text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors outline-none cursor-pointer">
                            {showAll ? t('alerts.showLess') : t('alerts.showMore', { count: overflow.length })}
                            {showAll ? <ChevronUp size={14} strokeWidth={1.5} /> : <ChevronDown size={14} strokeWidth={1.5} />}
                        </CollapsibleTrigger>
                    </>
                )}
            </Collapsible>
        </Card>
    );
};
