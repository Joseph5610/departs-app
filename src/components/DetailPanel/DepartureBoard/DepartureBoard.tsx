import { memo, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Train, ArrowRight, ChevronDown } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
    const { isLoading, isError, error, refetch, groupedDepartures, isFiltered, selectedLine } = useDepartures();

    const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
    
    const onToggleGroup = useCallback((group: string) => {
        setExpandedGroups(prev => prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]);
    }, []);

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
            <InfoTexts selectedStop={selectedStop} />
            
            {groupedDepartures.length === 0 ? (
                showMetroNightMessage ? (
                    <MetroNightMessage />
                ) : (
                    <Empty className="py-12 border-none">
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
                            className="overflow-hidden p-0 gap-0 border border-white/10 bg-[#161616] shadow-2xl rounded-2xl ring-0 mb-3"
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
                                                className="p-0 pb-0! bg-transparent relative overflow-hidden rounded-t-2xl! space-y-0 border-b-0"
                                            >
                                                <div 
                                                    className="absolute inset-0 opacity-100 pointer-events-none"
                                                    style={{
                                                        background: subFirstDep.route_color 
                                                            ? `linear-gradient(90deg, color-mix(in srgb, color-mix(in srgb, ${subFirstDep.route_color}, white 15%), black 50%) 0%, color-mix(in srgb, color-mix(in srgb, ${subFirstDep.route_color}, white 15%), black 70%) 100%)` 
                                                            : 'rgba(255,255,255,0.1)'
                                                    }}
                                                />
                                                <div className="relative z-10 flex flex-row items-center gap-2 p-3 px-4 w-full border-b-2"
                                                     style={{
                                                         borderBottomColor: subFirstDep.route_color || 'rgba(255,255,255,0.1)'
                                                     }}
                                                >
                                                <span
                                                    className={cn(
                                                        "inline-flex items-center justify-center font-bold text-white text-[11.5px] shadow-sm shrink-0",
                                                        (isMetro || ['A', 'B', 'C'].includes(String(lineGroup.line).toUpperCase()))
                                                            ? "rounded-full w-[24px] h-[24px]"
                                                            : "rounded-[4px] h-[24px] px-2 min-w-[24px]"
                                                    )}
                                                    style={{ 
                                                        backgroundColor: subFirstDep.route_color || FALLBACK_ROUTE_COLOR,
                                                        border: '1px solid rgba(255,255,255,0.15)'
                                                    }}
                                                >
                                                    {lineGroup.line}
                                                </span>
                                                <ArrowRight size={14} strokeWidth={1.5} className="text-muted-foreground opacity-40 shrink-0" />
                                                    <div className="flex flex-col flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <CardTitle className="text-[15px] font-semibold truncate min-w-0">
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
                                                    <Badge
                                                        variant="outline"
                                                        className="h-[18px] px-1.5 rounded-md text-[9px] font-bold tabular-nums flex items-center gap-1 bg-black/20 border-white/10! text-foreground/50 shrink-0"
                                                    >
                                                        <Train size={12} strokeWidth={1.5} className="opacity-40"  />
                                                        <span>{subFirstDep.platform}</span>
                                                    </Badge>
                                                )}
                                                </div>
                                            </CardHeader>
                                        ) : (
                                            /* Secondary Variant Header - Vibrant Glow Style */
                                            <div className="relative overflow-hidden border-t border-white/5">
                                                <div 
                                                    className="absolute inset-0 opacity-100 pointer-events-none"
                                                    style={{
                                                        background: subFirstDep.route_color 
                                                            ? `linear-gradient(90deg, color-mix(in srgb, color-mix(in srgb, ${subFirstDep.route_color}, white 15%), black 50%) 0%, color-mix(in srgb, color-mix(in srgb, ${subFirstDep.route_color}, white 15%), black 70%) 100%)` 
                                                            : 'rgba(255,255,255,0.1)'
                                                    }}
                                                />
                                                <div className="relative z-10 flex flex-row items-center gap-3 px-0 py-2.5 w-full">
                                                    <div 
                                                        className="w-1 h-4 rounded-r-sm shrink-0" 
                                                        style={{ backgroundColor: subFirstDep.route_color || FALLBACK_ROUTE_COLOR }}
                                                    />
                                                    <div className="flex items-center gap-2 flex-1 min-w-0 pr-3">
                                                        <ArrowRight size={12} strokeWidth={1.5} className="text-muted-foreground opacity-40 shrink-0" />
                                                        <span className="text-foreground/90 text-[14px] font-bold truncate">
                                                            {subGroup.headsign}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Departure Rows with zebra striping */}
                                        <CardContent className="p-0">
                                            <div className="flex flex-col divide-y divide-white/4">
                                                {visibleDepartures.map((dep: Departure, idx: number) => (
                                                    <div 
                                                        key={dep.tripId ? `${dep.tripId}-${dep.scheduled}` : idx}
                                                        className={cn(
                                                            "transition-colors",
                                                            idx % 2 === 1 ? "bg-white/[0.03]" : "bg-transparent"
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
                                            <button
                                                onClick={() => onToggleGroup(subGroup.groupId)}
                                                className="w-full py-2.5 flex items-center justify-center gap-2 bg-white/[0.04] hover:bg-white/10 transition-colors border-t border-white/5 text-muted-foreground/50 hover:text-foreground text-[10.5px] font-bold uppercase tracking-wider"
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
                                            </button>
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
