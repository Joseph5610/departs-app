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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/cn';
import { LineBadge } from '@/components/LineBadge';
import { ButtonTooltip } from '@/components/ButtonTooltip';
import { PanelActions } from '@/components/DetailPanel/PanelActions';
import { useIsMobile } from '@/hooks/useIsMobile';
import { NavigatePill } from '@/components/DetailPanel/NavigatePill';
import { useStopTwin } from '@/hooks/derived/useStopTwin';
import { FRONTEND_CITIES_CONFIG } from '@/config/cities';
import { navigate } from '@/lib/history';
import { paths } from '@/lib/routes';
import { Pressable } from '@/components/Pressable';

/** Sticky subheader of a stop's board: distance and delay, stop actions and filters, then the line chips. */
export const DepartureBoardHeader = memo(() => {
    const { t } = useTranslation();
    const isMobile = useIsMobile();

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
                        <Popover>
                            <PopoverTrigger className="hit-target flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-badge type-meta text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                                <Activity size={14} strokeWidth={1.75} className={cn(
                                    delayStats.trend === 'worsening' ? "text-destructive" :
                                    delayStats.trend === 'improving' || delayStats.averageDelayMin === 0 ? "text-tint-mint" :
                                    "text-muted-foreground"
                                )} />
                                {delayStats.averageDelayMin === 0
                                    ? t('map.departures.onTime')
                                    : `~${delayStats.averageDelayMin > 0 ? '+' : ''}${t('map.departures.minutes', { count: delayStats.averageDelayMin })}`}
                            </PopoverTrigger>
                            <PopoverContent side="bottom" align="center" className="w-auto">
                                <span className="type-meta text-foreground/90">
                                    {t('map.departures.delayStatsTooltip', { count: delayStats.sampleSize })}
                                </span>
                            </PopoverContent>
                        </Popover>
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
                {!isMobile && <PanelActions layout="chips" />}
            </div>

            {(uniqueLines.length > 0 || hasVehicleFilters) && (
                // One scrolling strip: the vehicle filters lead, then the line chips.
                <ChipStrip>
                        {hasVehicleFilters && (
                            <div role="group" aria-label={t('map.departures.vehicleFilters')} className="flex items-center gap-1.5">
                                {hasAirConditioningData && (
                                    <PropertyToggle
                                        isActive={requireAirConditioned}
                                        onToggle={toggleRequireAirConditioned}
                                        activeClassName="bg-sky-500 text-white"
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
                                        activeClassName="bg-blue-600 text-white"
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
                                            className={cn(
                                                "hit-target flex transition-[transform,opacity] active:scale-95 select-none hover:brightness-110 rounded-badge",
                                                isDimmed ? "opacity-30" : "opacity-100",
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

/** A row of filter chips scrolling sideways under the board header, fading out at its right edge. */
const ChipStrip = ({ children }: { children: React.ReactNode }) => (
    <div
        className="-mx-(--panel-gutter) -my-2 overflow-x-auto px-(--panel-gutter) pt-2.5 pb-2.5 no-scrollbar"
        style={{
            maskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent 100%)'
        }}
    >
        <div className="flex w-max items-center gap-1.5">
            {children}
            <div className="h-1 w-6 shrink-0" aria-hidden="true" />
        </div>
    </div>
);

/** One vehicle-property filter, shaped like the line chips it leads; the line chips filter by line instead. */
const PropertyToggle = ({ isActive, onToggle, activeClassName, label, testId, children }: {
    isActive: boolean;
    onToggle: () => void;
    activeClassName: string;
    label: string;
    testId: string;
    children: React.ReactNode;
}) => (
    <ButtonTooltip label={label}>
    <Pressable
        onClick={onToggle}
        aria-pressed={isActive}
        aria-label={label}
        data-testid={testId}
        className={cn(
            "hit-target flex size-6 shrink-0 items-center justify-center rounded-full transition-[transform,colors] active:scale-95 select-none focus-visible:ring-primary/50",
            isActive ? activeClassName : "bg-field text-muted-foreground hover:text-foreground"
        )}
    >
        {children}
    </Pressable>
    </ButtonTooltip>
);
