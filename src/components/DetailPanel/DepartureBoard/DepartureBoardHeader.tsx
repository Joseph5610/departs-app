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
import { lineChips } from '@/domain/departures';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/cn';
import { LineBadge } from '@/components/LineBadge';
import { ButtonTooltip } from '@/components/ButtonTooltip';
import { PanelActions } from '@/components/DetailPanel/PanelActions';
import { NavigatePill } from '@/components/DetailPanel/NavigatePill';
import { useStopTwin } from '@/hooks/derived/useStopTwin';
import { FRONTEND_CITIES_CONFIG } from '@/config/cities';
import { navigate } from '@/lib/history';
import { paths } from '@/lib/routes';

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

    const showHeader = !!selectedStop && !tripId && !isError;

    const uniqueLines = useMemo(() => {
        const source = lineChipsFromDepartures
            ? liveDepartures.map(dep => ({ name: dep.line, type: dep.type, route_color: dep.route_color ?? '' }))
            : selectedStop?.lines;
        return source ? lineChips(source, lineRules) : [];
    }, [selectedStop, lineRules, lineChipsFromDepartures, liveDepartures]);

    const hasVehicleFilters = hasAirConditioningData || hasAccessibilityData;

    if (!showHeader) {
        return null;
    }

    return (
        <div className="px-6 pb-0 shrink-0 flex flex-col gap-2.5">
            <div className="flex w-full min-h-8 items-center gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto no-scrollbar text-body-sm text-muted-foreground">
                    <NavigatePill />

                    {delayStats && delayStats.sampleSize >= 2 && (
                        <Popover>
                            <PopoverTrigger render={<Button variant="ghost" className="h-auto shrink-0 gap-1.5 whitespace-nowrap rounded-md p-0 text-body-sm font-normal text-muted-foreground hover:bg-transparent hover:text-foreground" />}>
                                <Activity size={14} className={cn(
                                    delayStats.trend === 'worsening' ? "text-destructive" :
                                    delayStats.trend === 'improving' ? "text-emerald-400" :
                                    "text-amber-400"
                                )} strokeWidth={1.5} />
                                {delayStats.averageDelayMin === 0
                                    ? t('map.departures.onTime')
                                    : `~${delayStats.averageDelayMin > 0 ? '+' : ''}${t('map.departures.minutes', { count: delayStats.averageDelayMin })}`}
                            </PopoverTrigger>
                            <PopoverContent side="bottom" align="center" className="w-auto">
                                <span className="text-body-sm font-medium text-foreground/90">
                                    {t('map.departures.delayStatsTooltip', { count: delayStats.sampleSize })}
                                </span>
                            </PopoverContent>
                        </Popover>
                    )}

                    {twin && twinLabel && (
                        <ButtonTooltip label={t('map.departures.otherNetworkBoard', { network: twinLabel })}>
                        <button
                            type="button"
                            onClick={() => navigate(paths.stop(twin.city, twin.stopId))}
                            aria-label={t('map.departures.otherNetworkBoard', { network: twinLabel })}
                            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md font-medium text-foreground outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                            <ArrowLeftRight size={14} strokeWidth={1.5} className="text-muted-foreground" />
                            {twinLabel}
                        </button>
                        </ButtonTooltip>
                    )}
                </div>
                <PanelActions chips />
            </div>

            {(uniqueLines.length > 0 || hasVehicleFilters) && (
                // One scrolling strip: the vehicle filters lead, then the line chips.
                <ChipStrip>
                        {(hasAirConditioningData || hasAccessibilityData) && (
                            <div role="group" aria-label={t('map.departures.vehicleFilters')} className="flex items-center gap-1.5">
                                {hasAirConditioningData && (
                                    <PropertyToggle
                                        isActive={requireAirConditioned}
                                        onToggle={toggleRequireAirConditioned}
                                        activeClassName="bg-sky-500 text-white"
                                        label={t('amenities.airConditioned')}
                                        testId="filter-ac"
                                    >
                                        <Snowflake size={14} strokeWidth={2} />
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
                                        <Accessibility size={14} strokeWidth={2} />
                                    </PropertyToggle>
                                )}
                            </div>
                        )}
                        {uniqueLines.length > 0 && hasVehicleFilters && <ChipDivider />}
                        {uniqueLines.length > 0 && (
                            <div role="group" aria-label={t('map.departures.lineFilters')} className="flex items-center gap-1.5">
                                {uniqueLines.map((line) => {
                                    const name = String(line.name || '');
                                    if (!name) return null;
                                    const isActive = selectedLine === name;
                                    const isDimmed = !!selectedLine && !isActive;
                                    return (
                                        <button
                                            key={name}
                                            onClick={() => toggleLineFilter(name)}
                                            className={cn(
                                                "flex transition-[transform,opacity] active:scale-95 select-none cursor-pointer hover:brightness-110 rounded-md",
                                                isDimmed ? "opacity-30" : "opacity-100",
                                                isActive && "z-10 ring-2 ring-primary/40"
                                            )}
                                        >
                                            <LineBadge name={name} routeColor={line.route_color || FALLBACK_ROUTE_COLOR} size="lg" />
                                        </button>
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
        className="-mx-6 overflow-x-auto px-6 pb-2.5 pt-0.5 no-scrollbar"
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

const ChipDivider = () => <div className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />;

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
    <button
        type="button"
        onClick={onToggle}
        aria-pressed={isActive}
        aria-label={label}
        data-testid={testId}
        className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md border transition-[transform,colors] active:scale-95 select-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            isActive ? cn(activeClassName, "border-transparent shadow-sm") : "bg-secondary border-border/50 text-secondary-foreground/60 hover:text-secondary-foreground"
        )}
    >
        {children}
    </button>
    </ButtonTooltip>
);
