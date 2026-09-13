
import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useGlobalAlerts } from '../../../hooks/data/useGlobalAlerts';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../../state/uiStore';
import { useCityConfig } from '../../../hooks/data/useCities';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CondensedAlertItem } from '../../Alerts/CondensedAlertItem';
import { Card } from '@/components/ui/card';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { VEHICLE_ALERTS_PREVIEW_COUNT } from '../../../config/constants';
import { isHighPriorityAlert } from '../../../utils/transitUtils';
import type { RSSItem } from '../../../types/alerts';

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
    const cityConfig = useCityConfig();

    const displayVehicle = useMemo<DisplayVehicle | null>(() => {
        if (!selectedVehicle) return null;
        // The selectedVehicle is already fully merged and enriched by the useSelectedVehicle hook.
        // DO NOT spread vehicleDetail over it again, as it will overwrite real-time WS data with stale HTTP data!
        const merged = { ...selectedVehicle };
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
            effectiveSequence
        };
    }, [selectedVehicle]);

    const relevantAlerts = useMemo(() => {
        const allItems = rssData?.alerts || [];
        const routeName = displayVehicle?.routeName;
        if (!routeName) return [];
        const upperRouteName = routeName.toUpperCase();
        return allItems
            .filter(item => {
                const matchesLine = item.lines?.some((l: string) => String(l).toUpperCase() === upperRouteName);
                const matchesMetadata = item.line_metadata?.some((m) => String(m.name).toUpperCase() === upperRouteName);
                return (matchesLine || matchesMetadata) && item.isActive;
            })
            .sort((a, b) => Number(isHighPriorityAlert(b.priority)) - Number(isHighPriorityAlert(a.priority)));
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
                        isDetailLoading={loadingDetail && !vehicleDetail}
                        hasEnrichment={!!cityConfig.enrichmentChannel}
                    />

                    {/* Alerts */}
                    {relevantAlerts.length > 0 && (
                        <div className="flex flex-col gap-3 mt-2">
                            <span className="micro-label-widest text-muted-foreground px-1">
                                {t('alerts.title')}
                                {relevantAlerts.length > 1 && ` (${relevantAlerts.length})`}
                            </span>
                            <LineAlertList alerts={relevantAlerts} />
                        </div>
                    )}

                    {/* Schedule / Stop List */}
                    {displayVehicle.stop_times?.features && displayVehicle.stop_times.features.length > 0 ? (
                        <StopTimeline
                            stopTimes={displayVehicle.stop_times.features}
                            effectiveSequence={displayVehicle.effectiveSequence}
                            delay={displayVehicle.delay}
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

    const preview = alerts.slice(0, VEHICLE_ALERTS_PREVIEW_COUNT);
    const overflow = alerts.slice(VEHICLE_ALERTS_PREVIEW_COUNT);

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
                            {overflow.map((alert, idx) => renderItem(alert, idx + VEHICLE_ALERTS_PREVIEW_COUNT))}
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
