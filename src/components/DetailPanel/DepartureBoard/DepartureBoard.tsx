import { memo, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { type Locale } from 'date-fns';
import { cs } from 'date-fns/locale/cs';
import { enUS } from 'date-fns/locale/en-US';
import { Box, Stack, HStack } from '@/components/ui/layout';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Departure, SelectedStop } from '../../../types/transit';
import { useDepartures } from '../../../hooks/data/useDepartures';
import { useStopDistance } from '../../../hooks/derived/useStopDistance';
import { DepartureItem } from './DepartureItem';
import { InfoTexts } from './InfoTexts';
import { MetroNightMessage } from './MetroNightMessage';
import { DepartureBoardSkeleton } from './DepartureBoardSkeleton';
import { METRO_STATIONS } from '../../../config/stations';

const dateLocales: Record<string, Locale> = {
    cs: cs,
    en: enUS
};

interface DepartureBoardProps {
    selectedStop: SelectedStop;
    onDepartureClick: (tripId: string, vehicleId?: string, initialData?: Partial<Departure>) => void;
}

/**
 * DepartureBoard
 *
 * Renders the list of upcoming departures for a selected stop,
 * grouped by line and type.
 */
export const DepartureBoard = memo(({ selectedStop, onDepartureClick }: DepartureBoardProps) => {
    const { t, i18n } = useTranslation();
    const { isLoading, groupedDepartures } = useDepartures();
    const stopDistanceInfo = useStopDistance();

    const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
    
    const onToggleGroup = useCallback((group: string) => {
        setExpandedGroups(prev => prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]);
    }, []);

    const locale = dateLocales[i18n.resolvedLanguage || i18n.language] || enUS;

    const showMetroNightMessage = useMemo(() => {
        if (groupedDepartures.length > 0) return false;
        const isMetroStation = selectedStop.stop_name ? !!METRO_STATIONS[selectedStop.stop_name] : false;
        const hour = new Date().getHours();
        const isNightTime = hour >= 0 && hour < 5;
        return isMetroStation && isNightTime;
    }, [selectedStop, groupedDepartures.length]);

    if (isLoading && groupedDepartures.length === 0) {
        return <DepartureBoardSkeleton />;
    }

    return (
        <Stack gap={4}>
            <InfoTexts selectedStop={selectedStop} />
            
            {groupedDepartures.length === 0 ? (
                showMetroNightMessage ? (
                    <MetroNightMessage />
                ) : (
                    <Box className="py-12 text-center text-muted-foreground">{t('map.departures.noUpcoming')}</Box>
                )
            ) : (
                groupedDepartures.map((group, index) => {
                    const isExpanded = expandedGroups.includes(group.groupId);
                    const visibleDepartures = isExpanded ? group.departures : [group.departures[0]];
                    const hasMore = group.departures.length > 1;

                    const prevGroup = index > 0 ? groupedDepartures[index - 1] : null;
                    const showHeader = !prevGroup || String(prevGroup.line) !== String(group.line) || String(prevGroup.type) !== String(group.type);

                    return (
                        <Stack key={group.groupId} gap={3} className={cn(!showHeader && "-mt-1")}>
                            {showHeader && (
                                <HStack gap={3} className="px-1">
                                    <Box
                                        className="px-3 py-1 rounded-lg font-bold text-white text-xs shadow-md"
                                        style={{ backgroundColor: group.departures[0]?.color || '#AD0B00' }}
                                    >
                                        {group.line}
                                    </Box>
                                    <Box className="h-[1px] flex-1 bg-border" />
                                </HStack>
                            )}

                        <Stack className="gap-2">
                            {visibleDepartures.map((dep: Departure, idx: number) => (
                                <DepartureItem
                                    key={idx}
                                    departure={dep}
                                    onDepartureClick={onDepartureClick}
                                    stopDistanceInfo={stopDistanceInfo}
                                    isTrainStop={selectedStop.is_train}
                                    locale={locale}
                                />
                            ))}

                            {hasMore && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onToggleGroup(group.groupId)}
                                    className="w-full h-auto py-2 text-foreground/70 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:text-foreground group"
                                >
                                    <Box className="h-[1px] flex-1 bg-border/40 group-hover:bg-border/80 transition-colors" />
                                    <span>{isExpanded ? t('map.departures.showLess') : t('map.departures.moreConnections', { count: group.departures.length - 1 })}</span>
                                    <Box className="h-[1px] flex-1 bg-border/40 group-hover:bg-border/80 transition-colors" />
                                </Button>
                            )}
                        </Stack>
                    </Stack>
                );
            })
        )}
        </Stack>
    );
});

DepartureBoard.displayName = 'DepartureBoard';
