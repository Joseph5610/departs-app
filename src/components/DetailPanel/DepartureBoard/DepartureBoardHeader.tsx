import React, { useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Snowflake, ArrowLeftRight, Accessibility } from 'lucide-react';
import { FALLBACK_ROUTE_COLOR } from '@/config/constants';
import { useSelectionStore } from '@/state/selectionStore';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useSelectedStop } from '@/hooks/derived/useSelectedStop';
import { useRouteParams } from '@/hooks/useRouteParams';
import { useDepartures } from '@/hooks/data/useDepartures';
import { useCityConfig, useLineRules } from '@/hooks/data/useCities';
import { departureLines, lineChips } from '@/domain/departures';
import { useRouteMetadata } from '@/hooks/data/useRouteMetadata';
import { cn } from '@/lib/cn';
import { LineBadge } from '@/components/LineBadge';
import { ButtonTooltip } from '@/components/ButtonTooltip';
import { NavigatePill } from '@/components/DetailPanel/NavigatePill';
import { useStopTwin } from '@/hooks/derived/useStopTwin';
import { FRONTEND_CITIES_CONFIG } from '@/config/cities';
import { navigate } from '@/lib/history';
import { paths } from '@/lib/routes';
import { Pressable } from '@/components/Pressable';
import { ChipStrip } from '@/components/ChipStrip';
import { Toggle } from '@/components/ui/toggle';
import { TapHint } from '@/components/TapHint';

/** Sticky subheader of a stop's board: distance and delay, stop actions and filters, then the line chips. */
export const DepartureBoardHeader = memo(() => {
    const { t } = useTranslation();

    const requireAirConditioned = usePreferencesStore(s => s.requireAirConditioned);
    const requireWheelchairAccessible = usePreferencesStore(s => s.requireWheelchairAccessible);
    const { toggleRequireAirConditioned, toggleRequireWheelchairAccessible } = usePreferencesStore(s => s.actions);

    const selectedLine = useSelectionStore(s => s.selectedLine);
    const { toggleLineFilter } = useSelectionStore(s => s.actions);

    const selectedStop = useSelectedStop();
    const { tripId } = useRouteParams();

    const { liveDepartures, delayStats, isError, hasAirConditioningData, hasAccessibilityData } = useDepartures();

    const { lineChipsFromDepartures } = useCityConfig();
    const twin = useStopTwin();
    const twinLabel = twin ? FRONTEND_CITIES_CONFIG[twin.city]?.networkLabel : undefined;
    const lineRules = useLineRules();
    const { byShortName } = useRouteMetadata();

    const showHeader = !!selectedStop && !tripId && !isError;

    const uniqueLines = useMemo(() => {
        const source = lineChipsFromDepartures ? departureLines(liveDepartures, byShortName) : selectedStop?.board?.lines;
        return source ? lineChips(source, lineRules) : [];
    }, [selectedStop, lineRules, lineChipsFromDepartures, liveDepartures, byShortName]);

    const hasVehicleFilters = hasAirConditioningData || hasAccessibilityData;

    if (!showHeader) {
        return null;
    }

    return (
        <div className="px-(--panel-gutter) pb-0 shrink-0 flex flex-col gap-2.5">
            <div className="flex w-full min-h-8 items-center gap-3">
                <div className="-my-1.5 flex min-w-0 flex-1 items-center gap-3 overflow-x-auto py-1.5 no-scrollbar type-meta text-muted-foreground">
                    <NavigatePill />

                    {delayStats && delayStats.sampleSize >= 2 && (
                        <TapHint side="bottom" className="hit-target gap-1.5 whitespace-nowrap rounded-badge" hint={t('map.departures.delayStatsTooltip', { count: delayStats.sampleSize })}>
                                <Activity size={14} strokeWidth={1.75} className={cn(
                                    delayStats.trend === 'worsening' ? "text-destructive" :
                                    delayStats.trend === 'improving' || delayStats.averageDelayMin === 0 ? "text-tint-mint" :
                                    "text-muted-foreground"
                                )} />
                                {delayStats.averageDelayMin === 0
                                    ? t('map.departures.onTime')
                                    : `~${delayStats.averageDelayMin > 0 ? '+' : ''}${t('map.departures.minutes', { count: delayStats.averageDelayMin })}`}
                        </TapHint>
                    )}

                    {twin && twinLabel && (
                        <ButtonTooltip label={t('map.departures.otherNetworkBoard', { network: twinLabel })}>
                        <Pressable
                            onClick={() => navigate(paths.stop(twin.city, twin.stopId))}
                            aria-label={t('map.departures.otherNetworkBoard', { network: twinLabel })}
                            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-badge font-medium text-foreground transition-colors hover:text-tint-mint"
                        >
                            <ArrowLeftRight size={14} strokeWidth={1.5} className="text-muted-foreground" />
                            {twinLabel}
                        </Pressable>
                        </ButtonTooltip>
                    )}
                </div>
            </div>

            {(uniqueLines.length > 0 || hasVehicleFilters) && (
                // One scrolling strip: the vehicle filters lead, then the line chips.
                <ChipStrip bleed>
                        {hasVehicleFilters && (
                            <div role="group" aria-label={t('map.departures.vehicleFilters')} className="flex items-center gap-1.5">
                                {hasAirConditioningData && (
                                    <PropertyToggle
                                        isActive={requireAirConditioned}
                                        onToggle={toggleRequireAirConditioned}
                                        label={t('amenities.airConditioned')}
                                        testId="filter-ac"
                                    >
                                        <Snowflake size={14} strokeWidth={1.75} />
                                    </PropertyToggle>
                                )}
                                {hasAccessibilityData && (
                                    <PropertyToggle
                                        isActive={requireWheelchairAccessible}
                                        onToggle={toggleRequireWheelchairAccessible}
                                        label={t('amenities.wheelchairAccessible')}
                                        testId="filter-accessible"
                                    >
                                        <Accessibility size={14} strokeWidth={1.75} />
                                    </PropertyToggle>
                                )}
                            </div>
                        )}
                        {uniqueLines.length > 0 && (
                            <div role="group" aria-label={t('map.departures.lineFilters')} className="flex items-center gap-1.5">
                                {uniqueLines.map((line) => {
                                    const name = String(line.name || '');
                                    if (!name) return null;
                                    const isActive = selectedLine === name;
                                    const isDimmed = !!selectedLine && !isActive;
                                    return (
                                        <Pressable
                                            key={name}
                                            onClick={() => toggleLineFilter(name)}
                                            aria-pressed={isActive}
                                            className={cn(
                                                "hit-target flex select-none rounded-badge",
                                                isDimmed && "opacity-30",
                                                isActive && "z-10 ring-2 ring-primary/40"
                                            )}
                                        >
                                            <LineBadge name={name} routeColor={line.route_color || FALLBACK_ROUTE_COLOR} size="lg" />
                                        </Pressable>
                                    );
                                })}
                            </div>
                        )}
                </ChipStrip>
            )}
        </div>
    );
});

DepartureBoardHeader.displayName = 'DepartureBoardHeader';

/** One vehicle-property filter, shaped like the line chips it leads; the line chips filter by line instead. */
const PropertyToggle = ({ isActive, onToggle, label, testId, children }: {
    isActive: boolean;
    onToggle: () => void;
    label: string;
    testId: string;
    children: React.ReactNode;
}) => (
    <ButtonTooltip label={label}>
        <Toggle size="icon" pressed={isActive} onPressedChange={onToggle} aria-label={label} data-testid={testId}>
            {children}
        </Toggle>
    </ButtonTooltip>
);
