import { memo, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Train, ArrowRight, ChevronDown } from 'lucide-react';
import { Box, Stack, HStack } from '@/components/ui/layout';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Departure, SelectedStop } from '../../../types/transit';
import { useDepartures } from '../../../hooks/data/useDepartures';
import { DepartureItem } from './DepartureItem';
import { InfoTexts } from './InfoTexts';
import { MetroNightMessage } from './MetroNightMessage';
import { DepartureBoardSkeleton } from './DepartureBoardSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import type { AppError } from '@/types/error';

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
        <Stack gap={3}>
            <InfoTexts selectedStop={selectedStop} />
            
            {groupedDepartures.length === 0 ? (
                showMetroNightMessage ? (
                    <MetroNightMessage />
                ) : (
                    <Box className="py-12 text-center text-muted-foreground">
                        {isFiltered 
                            ? t('map.departures.noUpcomingForLine', { line: selectedLine }) 
                            : t('map.departures.noUpcoming')}
                    </Box>
                )
            ) : (
                groupedDepartures.map((lineGroup) => {
                    const firstSub = lineGroup.subGroups[0];
                    const firstDep = firstSub.departures[0];
                    const isMetro = firstDep.type === '1' || firstDep.type === 'metro' || ['A', 'B', 'C'].includes(String(firstDep.line).toUpperCase());
                    return (
                        <div 
                            key={lineGroup.lineGroupId} 
                            className={cn(
                                "flex flex-col rounded-xl overflow-hidden border border-white/4 bg-white/4",
                                "mt-1 shadow-sm"
                            )}
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
                                const hasMore = hiddenCount > 0 && !isFiltered;

                                return (
                                    <div key={subGroup.groupId} className="flex flex-col">
                                        {/* Sub-group header */}
                                        {isFirstSub ? (
                                            /* Main Header - Vibrant Sophisticated Gradient */
                                            <HStack 
                                                gap={2} 
                                                className="px-3 py-2.5 items-center border-b-2"
                                                style={{
                                                    background: subFirstDep.route_color 
                                                        ? `linear-gradient(90deg, color-mix(in srgb, color-mix(in srgb, ${subFirstDep.route_color}, white 15%), black 50%) 0%, color-mix(in srgb, color-mix(in srgb, ${subFirstDep.route_color}, white 15%), black 70%) 100%)` 
                                                        : 'rgba(255,255,255,0.1)',
                                                    borderBottomColor: subFirstDep.route_color 
                                                        ? subFirstDep.route_color 
                                                        : 'rgba(255,255,255,0.1)'
                                                }}
                                            >
                                                <span
                                                    className={cn(
                                                        "inline-flex items-center justify-center font-bold text-white text-[11px] shadow-sm shrink-0",
                                                        (isMetro || ['A', 'B', 'C'].includes(String(lineGroup.line).toUpperCase()))
                                                            ? "rounded-full w-[22px] h-[22px]"
                                                            : "rounded-[4px] h-[22px] px-2 min-w-[22px]"
                                                    )}
                                                    style={{ 
                                                        backgroundColor: subFirstDep.route_color || '#AD0B00',
                                                        border: '1px solid rgba(255,255,255,0.15)'
                                                    }}
                                                >
                                                    {lineGroup.line}
                                                </span>
                                                <ArrowRight size={12} className="text-muted-foreground/40 shrink-0" />
                                                <span className="text-foreground/90 text-sm font-semibold truncate min-w-0 flex-1">
                                                    {subGroup.headsign}
                                                    {subFirstDep.headsign_metro_lines?.map((line) => (
                                                        <span 
                                                            key={line.name} 
                                                            className="inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-sm text-[9px] text-white font-black ml-1 align-baseline -translate-y-px"
                                                            style={{ backgroundColor: line.route_color }}
                                                        >
                                                            {line.name}
                                                        </span>
                                                    ))}
                                                </span>

                                                {/* Platform badge (metro only) */}
                                                {isMetro && subFirstDep.platform && (
                                                    <Badge
                                                        variant="outline"
                                                        className="h-[18px] px-1.5 rounded-md text-[9px] font-bold tabular-nums flex items-center gap-1 bg-black/20 border-white/10! text-foreground/50 shrink-0"
                                                    >
                                                        <Train size={9} strokeWidth={2.5} className="opacity-40" />
                                                        <span>{subFirstDep.platform}</span>
                                                    </Badge>
                                                )}
                                            </HStack>
                                        ) : (
                                            /* Secondary Variant Header - Vibrant Glow Style */
                                            <HStack 
                                                gap={3} 
                                                className="px-0 py-2 items-center border-t border-white/5"
                                                style={{
                                                    background: subFirstDep.route_color 
                                                        ? `linear-gradient(90deg, color-mix(in srgb, color-mix(in srgb, ${subFirstDep.route_color}, white 15%), black 50%) 0%, transparent 100%)` 
                                                        : 'rgba(255,255,255,0.04)'
                                                }}
                                            >
                                                <div 
                                                    className="w-1 h-4 rounded-r-sm shrink-0" 
                                                    style={{ backgroundColor: subFirstDep.route_color || '#AD0B00' }}
                                                />
                                                <div className="flex items-center gap-2 flex-1 min-w-0 pr-3">
                                                    <ArrowRight size={10} className="text-muted-foreground/40 shrink-0" />
                                                    <span className="text-foreground/90 text-[13px] font-bold truncate">
                                                        {subGroup.headsign}
                                                    </span>
                                                </div>
                                            </HStack>
                                        )}

                                        {/* Departure Rows with zebra striping */}
                                        <div className="flex flex-col divide-y divide-white/4">
                                            {visibleDepartures.map((dep: Departure, idx: number) => (
                                                <div 
                                                    key={dep.tripId ? `${dep.tripId}-${dep.scheduled}` : idx}
                                                    className={cn(
                                                        "transition-colors",
                                                        idx % 2 === 1 ? "bg-white/2" : "bg-transparent"
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

                                        {/* Expansion for this Sub-group */}
                                        {hasMore && (
                                            <button
                                                onClick={() => onToggleGroup(subGroup.groupId)}
                                                className="w-full py-2 flex items-center justify-center gap-2 bg-white/2 hover:bg-white/6 transition-colors border-t border-white/5 text-muted-foreground/50 hover:text-foreground text-[10px] font-bold uppercase tracking-wider"
                                            >
                                                <ChevronDown 
                                                    size={12} 
                                                    className={cn("transition-transform duration-200", isExpanded && "rotate-180")} 
                                                />
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
                        </div>
                    );
                })
            )}
        </Stack>
    );
});

DepartureBoard.displayName = 'DepartureBoard';
