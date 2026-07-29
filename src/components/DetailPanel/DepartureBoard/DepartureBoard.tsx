import { memo, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { Train, ArrowRight, ChevronDown } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import type { Departure, SelectedStop } from '../../../types/transit';
import { useDepartures } from '../../../hooks/data/useDepartures';
import { DepartureItem } from './DepartureItem';
import { InfoTexts } from './InfoTexts';
import { MetroNightMessage } from './MetroNightMessage';
import { DepartureBoardSkeleton } from './DepartureBoardSkeleton';
import { ErrorState } from '@/components/DetailPanel/ErrorState';
import { LineBadge } from '../../LineBadge';
import type { AppError } from '@/types/error';
import { FALLBACK_ROUTE_COLOR } from '@/config/constants';

/** How many departures to show per group before requiring expand */
const DEFAULT_VISIBLE = 3;

interface DepartureBoardProps {
    selectedStop: SelectedStop;
    onDepartureClick: (tripId: string, vehicleId?: string, initialData?: Partial<Departure>) => void;
}

/**
 * DepartureBoard
 *
 * Renders the list of upcoming departures for a selected stop,
 * grouped by line and type. High-density tabular layout.
 */
export const DepartureBoard = memo(({ selectedStop, onDepartureClick }: DepartureBoardProps) => {
    const { t } = useTranslation();
    const { isLoading, isError, error, refetch, groupedDepartures, isFiltered, selectedLine, data } = useDepartures();

    const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
    
    const onToggleGroup = useCallback((group: string) => {
        setExpandedGroups(prev => prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]);
    }, []);

    const jsonLd = useMemo(() => {
        if (!data?.departures || data.departures.length === 0) return null;
        
        // Take up to 15 upcoming departures to avoid bloating the DOM
        const upcoming = data.departures.slice(0, 15).map(dep => ({
            "@type": "TrainTrip",
            "trainNumber": String(dep.line),
            "trainName": dep.headsign,
            "departureTime": dep.scheduled,
            "description": `Delay: ${dep.delay || 0} seconds`,
            "departurePlatform": dep.platform || undefined
        }));

        return {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": "Live Departures",
            "itemListElement": upcoming
        };
    }, [data?.departures]);

    const showMetroNightMessage = useMemo(() => {
        if (groupedDepartures.length > 0) return false;
        if (isFiltered) return false;
        const isMetroStation = (selectedStop.metro_lines?.length ?? 0) > 0;

        const hour = new Date().getHours();
        const isNightTime = hour >= 0 && hour < 5;
        return isMetroStation && isNightTime;
    }, [selectedStop, groupedDepartures.length, isFiltered]);

    if (isLoading && groupedDepartures.length === 0) {
        return <DepartureBoardSkeleton />;
    }

    if (isError && groupedDepartures.length === 0) {
        return <ErrorState error={error as AppError} onRetry={refetch} />;
    }

    return (
        <div className="flex flex-col gap-3">
            {jsonLd && (
                <Helmet>
                    <script type="application/ld+json">
                        {JSON.stringify(jsonLd)}
                    </script>
                </Helmet>
            )}
            <InfoTexts selectedStop={selectedStop} />
            
            {groupedDepartures.length === 0 ? (
                showMetroNightMessage ? (
                    <MetroNightMessage />
                ) : (
                    <Empty className="py-12">
                        <EmptyHeader>
                            <EmptyMedia
                                variant="icon"
                                className="size-14 rounded-2xl bg-muted/30 border border-border/50 text-muted-foreground shadow-sm [&_svg:not([class*='size-'])]:size-7"
                            >
                                <Train strokeWidth={1.5} className="opacity-50" />
                            </EmptyMedia>
                            <EmptyTitle className="text-base font-bold text-foreground/80">
                                {isFiltered 
                                    ? t('map.departures.noUpcomingForLine', { line: selectedLine }) 
                                    : t('map.departures.noUpcoming')}
                            </EmptyTitle>
                            <EmptyDescription className="text-sm">
                                {t('map.departures.noUpcomingDescription', { defaultValue: 'Check back later or view the official schedule.' })}
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                )
            ) : (
                groupedDepartures.map((lineGroup) => {
                    const firstSub = lineGroup.subGroups[0];
                    const firstDep = firstSub.departures[0];
                    const isMetro = firstDep.type === '1' || firstDep.type === 'metro' || ['A', 'B', 'C'].includes(String(firstDep.line).toUpperCase());
                    return (
                        <Card 
                            key={lineGroup.lineGroupId} 
                            size="none"
                            className="border border-border/50 dark:border-white/10 ring-0 bg-card dark:bg-[#161616] shadow-sm mb-3 overflow-hidden"
                        >
                            {lineGroup.subGroups.map((subGroup, subIdx) => {
                                const isFirstSub = subIdx === 0;
                                
                                const subFirstDep = subGroup.departures[0];
                                const isExpanded = isFiltered || expandedGroups.includes(subGroup.groupId);
                                
                                // Logic: If only ONE connection would be hidden, show it immediately.
                                // Otherwise, show only the default amount and provide an expand button.
                                const hiddenCountIfDefault = subGroup.departures.length - DEFAULT_VISIBLE;
                                const showAllByDefault = hiddenCountIfDefault === 1;
                                
                                const visibleDepartures = (isExpanded || showAllByDefault)
                                    ? subGroup.departures 
                                    : subGroup.departures.slice(0, DEFAULT_VISIBLE);
                                    
                                const hiddenCount = subGroup.departures.length - visibleDepartures.length;
                                const hasMore = !showAllByDefault && subGroup.departures.length > DEFAULT_VISIBLE && !isFiltered;

                                return (
                                    <div key={subGroup.groupId} className="flex flex-col">
                                        {/* Sub-group header */}
                                        {isFirstSub ? (
                                            /* Main Header - Vibrant Sophisticated Gradient */
                                            <CardHeader 
                                                className="p-0 pb-0! bg-transparent relative border-b-0"
                                            >
                                                <div 
                                                    className="absolute inset-0 pointer-events-none dark:hidden opacity-[0.15] rounded-t-2xl"
                                                    style={{
                                                        background: subFirstDep.route_color 
                                                            ? `linear-gradient(90deg, ${subFirstDep.route_color} 0%, transparent 100%)` 
                                                            : 'none'
                                                    }}
                                                />
                                                <div 
                                                    className="absolute inset-0 pointer-events-none hidden dark:block rounded-t-2xl"
                                                    style={{
                                                        background: subFirstDep.route_color 
                                                            ? `linear-gradient(90deg, color-mix(in srgb, color-mix(in srgb, ${subFirstDep.route_color}, white 15%), black 50%) 0%, color-mix(in srgb, color-mix(in srgb, ${subFirstDep.route_color}, white 15%), black 70%) 100%)` 
                                                            : 'rgba(255,255,255,0.1)'
                                                    }}
                                                />
                                                <div className="relative z-10 flex items-center gap-2 p-3 px-4 w-full border-b-2"
                                                     style={{
                                                         borderBottomColor: subFirstDep.route_color 
                                                             ? `color-mix(in srgb, ${subFirstDep.route_color} 60%, transparent)` 
                                                             : 'rgba(255,255,255,0.15)'
                                                     }}
                                                >
                                                <LineBadge 
                                                    name={String(lineGroup.line)} 
                                                    routeColor={subFirstDep.route_color || FALLBACK_ROUTE_COLOR} 
                                                    size="lg" 
                                                    className="shadow-sm" 
                                                />
                                                <ArrowRight size={14} strokeWidth={1.5} className="text-muted-foreground opacity-40 shrink-0" />
                                                    <div className="flex flex-col flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <CardTitle className="text-[15px] font-semibold truncate min-w-0 text-foreground">
                                                                {subGroup.headsign}
                                                            </CardTitle>
                                                            {subFirstDep.headsign_metro_lines && subFirstDep.headsign_metro_lines.length > 0 && (
                                                                <div className="flex gap-1 shrink-0">
                                                                    {subFirstDep.headsign_metro_lines.map((line) => (
                                                                        <LineBadge key={line.name} name={line.name} routeColor={line.route_color} />
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                {/* Platform badge (metro only) */}
                                                {isMetro && subFirstDep.platform && (
                                                    <TooltipProvider delay={300}>
                                                        <Tooltip>
                                                            <TooltipTrigger>
                                                                <div
                                                                    className="flex items-center justify-center shrink-0 w-5 h-5 bg-foreground rounded-full shadow-sm cursor-default"
                                                                >
                                                                    <span className="text-background font-extrabold text-xs leading-none text-center inline-block">
                                                                        {subFirstDep.platform}
                                                                    </span>
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>{t('map.departures.trackNumber', { track: subFirstDep.platform })}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
                                                </div>
                                            </CardHeader>
                                        ) : (
                                            /* Secondary Variant Header - Vibrant Glow Style */
                                            <div className="relative overflow-hidden border-t border-border/50 dark:border-white/5">
                                                <div 
                                                    className="absolute inset-0 pointer-events-none dark:hidden opacity-[0.10]"
                                                    style={{
                                                        background: subFirstDep.route_color 
                                                            ? `linear-gradient(90deg, ${subFirstDep.route_color} 0%, transparent 100%)` 
                                                            : 'none'
                                                    }}
                                                />
                                                <div 
                                                    className="absolute inset-0 pointer-events-none hidden dark:block"
                                                    style={{
                                                        background: subFirstDep.route_color 
                                                            ? `linear-gradient(90deg, color-mix(in srgb, color-mix(in srgb, ${subFirstDep.route_color}, white 15%), black 50%) 0%, color-mix(in srgb, color-mix(in srgb, ${subFirstDep.route_color}, white 15%), black 70%) 100%)` 
                                                            : 'rgba(255,255,255,0.1)'
                                                    }}
                                                />
                                                <div className="relative z-10 flex items-center gap-3 px-0 py-2.5 w-full">
                                                    <div 
                                                        className="w-1 h-4 rounded-r-sm shrink-0" 
                                                        style={{ backgroundColor: subFirstDep.route_color || FALLBACK_ROUTE_COLOR }}
                                                    />
                                                    <div className="flex items-center gap-2 flex-1 min-w-0 pr-3">
                                                        <ArrowRight size={12} strokeWidth={1.5} className="text-muted-foreground opacity-40 shrink-0" />
                                                        <span className="text-foreground/90 text-sm font-bold truncate">
                                                            {subGroup.headsign}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Departure Rows with zebra striping */}
                                        <CardContent className="p-0">
                                            <div className="flex flex-col divide-y divide-black/5 dark:divide-white/5">
                                                {visibleDepartures.map((dep: Departure, idx: number) => (
                                                    <div 
                                                        key={dep.tripId ? `${dep.tripId}-${dep.scheduled}` : idx}
                                                        className={cn(
                                                            "transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.04]",
                                                            idx % 2 === 1 ? "bg-black/[0.015] dark:bg-white/[0.02]" : "bg-transparent"
                                                        )}
                                                    >
                                                        <DepartureItem
                                                            departure={dep}
                                                            onDepartureClick={onDepartureClick}
                                                            hideHeadsign={true}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>

                                        {/* Expansion for this Sub-group */}
                                        {hasMore && (
                                            <Button
                                                variant="ghost"
                                                onClick={() => onToggleGroup(subGroup.groupId)}
                                                className="w-full h-auto py-2.5 flex items-center justify-center gap-2 bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.03] dark:hover:bg-white/[0.08] transition-colors border-t border-black/5 dark:border-white/5 text-muted-foreground/70 dark:text-muted-foreground/60 hover:text-foreground text-[10.5px] font-bold uppercase tracking-wider rounded-b-[11px] rounded-t-none"
                                            >
                                                <ChevronDown 
                                                    size={14} 
                                                    className={cn("transition-transform duration-200", isExpanded && "rotate-180")} 
                                                 strokeWidth={1.5} />
                                                <span>
                                                    {isExpanded 
                                                        ? t('map.departures.showLess') 
                                                        : t('map.departures.moreConnections', { count: hiddenCount })}
                                                </span>
                                            </Button>
                                        )}
                                    </div>
                                );
                            })}
                        </Card>
                    );
                })
            )}
        </div>
    );
});

DepartureBoard.displayName = 'DepartureBoard';
