import React, { useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Activity, Footprints, Snowflake, ArrowLeftRight, Accessibility } from 'lucide-react';
import { FALLBACK_ROUTE_COLOR } from '@/config/constants';
import { useSelectionStore } from '@/state/selectionStore';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useSelectedStop } from '@/hooks/derived/useSelectedStop';
import { useRouteParams } from '@/hooks/useRouteParams';
import { useDepartures } from '@/hooks/data/useDepartures';
import { useCityConfig, useLineRules } from '@/hooks/data/useCities';
import { lineChips } from '@/domain/departures';
import { useNavigate } from '@/hooks/features/useNavigate';
import { formatStopDistance } from '@/hooks/derived/useStopDistance';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from 'cn';
import { LineBadge } from '@/components/LineBadge';
import { PanelActions } from '@/components/DetailPanel/PanelActions';
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

    const { handleNavigate, stopDistanceInfo } = useNavigate();
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

    if (!showHeader) {
        return null;
    }

    return (
        <div className="px-6 pb-0 shrink-0 flex flex-col gap-2">
            <div className="flex w-full h-7 items-center">
                <div className="flex gap-2 min-w-0 items-center">
                    <div className="flex items-center h-7 rounded-full bg-card border border-border/50 shadow-sm shrink-0 overflow-hidden">
                        <div 
                            className="flex items-center h-full px-3 hover:bg-muted active:bg-muted/80 transition-colors cursor-pointer"
                            onClick={() => handleNavigate()}
                        >
                             <MapPin size={12} className="text-muted-foreground/80 mr-1"  strokeWidth={1.5} />
                             <span className="font-bold text-foreground text-[11px] tracking-tight whitespace-nowrap flex items-center">
                                {stopDistanceInfo?.isReasonableWalkingDistance ? (
                                    <>
                                        <span>{t('map.departures.meters', { distance: stopDistanceInfo.distance })}</span>
                                        <span className="mx-1.5 opacity-30 font-normal">•</span>
                                        <Footprints size={14} className="mr-1 text-muted-foreground/60"  strokeWidth={1.5} />
                                        <span>{t('map.departures.minutes', { count: stopDistanceInfo.time })}</span>
                                    </>
                                ) : (
                                    stopDistanceInfo ? formatStopDistance(stopDistanceInfo, t) : t('map.departures.openInMaps')
                                )}
                             </span>
                        </div>

                        {delayStats && delayStats.sampleSize >= 2 && (
                            <>
                                <div className="w-px h-3 bg-border shrink-0" />
                                <Popover>
                                    <PopoverTrigger render={<Button variant="ghost" className="h-7 px-3 gap-1 rounded-md transition-colors hover:bg-muted active:scale-95" />}>
                                        <Activity size={12} className={cn(
                                            delayStats.trend === 'worsening' ? "text-destructive" :
                                            delayStats.trend === 'improving' ? "text-emerald-400" :
                                            "text-amber-400"
                                        )} strokeWidth={1.5} />
                                        <span className="font-bold text-foreground text-[11px] tracking-tight opacity-90 whitespace-nowrap">
                                            {delayStats.averageDelayMin === 0 
                                                ? t('map.departures.onTime') 
                                                : `~${delayStats.averageDelayMin > 0 ? '+' : ''}${t('map.departures.minutes', { count: delayStats.averageDelayMin })}`}
                                        </span>
                                    </PopoverTrigger>
                                    <PopoverContent side="bottom" align="center" className="w-auto border bg-popover/95 backdrop-blur-xl shadow-2xl">
                                        <span className="text-[13px] font-medium text-foreground/90">
                                            {t('map.departures.delayStatsTooltip', { count: delayStats.sampleSize })}
                                        </span>
                                    </PopoverContent>
                                </Popover>
                            </>
                        )}
                    </div>
                    <PanelActions chips />
                    {twin && twinLabel && (
                        <Button
                            variant="ghost"
                            onClick={() => navigate(paths.stop(twin.city, twin.stopId))}
                            aria-label={t('map.departures.otherNetworkBoard', { network: twinLabel })}
                            title={t('map.departures.otherNetworkBoard', { network: twinLabel })}
                            className="h-7 px-3 gap-1.5 shrink-0 rounded-full border border-border/50 bg-card shadow-sm text-[11px] font-bold"
                        >
                            <ArrowLeftRight size={12} strokeWidth={1.5} className="text-muted-foreground" />
                            {twinLabel}
                        </Button>
                    )}
                </div>
            </div>

            {(uniqueLines.length > 0 || hasAirConditioningData || hasAccessibilityData) && (
                <div className="flex items-center gap-2 py-2">
                    {(hasAirConditioningData || hasAccessibilityData) && (
                        <>
                            <div role="group" aria-label={t('map.departures.vehicleFilters')} className="flex shrink-0 items-center gap-1.5">
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
                            {uniqueLines.length > 0 && <div className="w-px h-5 shrink-0 bg-border" aria-hidden="true" />}
                        </>
                    )}

                    {uniqueLines.length > 0 && (
                        <div
                            role="group"
                            aria-label={t('map.departures.lineFilters')}
                            className="flex-1 min-w-0 -my-2 -mr-2 py-2 pr-2 pl-0.5 overflow-x-auto no-scrollbar"
                            style={{
                                maskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent 100%)',
                                WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent 100%)'
                            }}
                        >
                            <div className="flex gap-1.5 justify-start">
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
                                <div className="shrink-0 w-8 h-1" />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

DepartureBoardHeader.displayName = 'DepartureBoardHeader';

/** One vehicle-property filter in the toggle group; the line badges filter by line instead. */
const PropertyToggle = ({ isActive, onToggle, activeClassName, label, testId, children }: {
    isActive: boolean;
    onToggle: () => void;
    activeClassName: string;
    label: string;
    testId: string;
    children: React.ReactNode;
}) => (
    <button
        type="button"
        onClick={onToggle}
        aria-pressed={isActive}
        aria-label={label}
        title={label}
        data-testid={testId}
        className={cn(
            "flex items-center justify-center size-6 rounded-md border transition-[transform,colors] active:scale-95 select-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            isActive ? cn(activeClassName, "border-transparent shadow-sm") : "bg-secondary border-border/50 text-secondary-foreground/60 hover:text-secondary-foreground"
        )}
    >
        {children}
    </button>
);
