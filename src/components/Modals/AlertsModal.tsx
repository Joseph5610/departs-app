
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search as SearchIcon, X } from 'lucide-react';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useGlobalAlerts } from '../../hooks/data/useGlobalAlerts';
import type { RSSItem } from '../../types/transit';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CondensedAlertItem } from '../Alerts/CondensedAlertItem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GroupedVirtuoso } from 'react-virtuoso';

// Helper to determine the primary transport mode of an alert
const getTransportMode = (item: RSSItem): string => {
    if (!item.line_metadata || item.line_metadata.length === 0) return 'other';
    const type = item.line_metadata[0].type;
    switch (String(type)) {
        case '1': return 'metro';
        case '0': return 'tram';
        case '3': return 'bus';
        case '11': return 'trolleybus';
        case '2': return 'train';
        default: return 'other';
    }
};

const MODE_ORDER = ['metro', 'tram', 'bus', 'trolleybus', 'train', 'other'];

/**
 * Alerts Component
 *
 * Redesigned with GroupedVirtuoso for performance and grouped by transport mode.
 */
export const AlertsModal: React.FC = () => {
    const { t } = useTranslation();

    // Preferences
    const isAlertsOpen = usePreferencesStore(s => s.isAlertsOpen);
    const { setIsAlertsOpen } = usePreferencesStore(s => s.actions);
    
    const [filterMode, setFilterMode] = useState<'all' | 'incident' | 'exclusion'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const { rss } = useGlobalAlerts();
    const { data: rssData, isLoading: loadingRSS } = rss;

    // Grouping and Filtering logic
    const { groupCounts, items, groups } = useMemo(() => {
        const rawItems = rssData?.alerts || [];

        // 1. Filter
        const filtered = rawItems.filter(item => {
            // Filter by type
            if (filterMode === 'incident' && item.type !== 'incident') return false;
            if (filterMode === 'exclusion' && item.type !== 'exclusion') return false;

            // Search
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchesTitle = item.title.toLowerCase().includes(q);
                const matchesDesc = item.description?.toLowerCase().includes(q);
                const matchesLine = item.lines?.some((l: string) => l.toLowerCase().includes(q));
                if (!matchesTitle && !matchesDesc && !matchesLine) return false;
            }
            return true;
        });

        // 2. Group by mode
        const groupedMap = new Map<string, RSSItem[]>();
        filtered.forEach(item => {
            const mode = getTransportMode(item);
            if (!groupedMap.has(mode)) groupedMap.set(mode, []);
            groupedMap.get(mode)!.push(item);
        });

        // 3. Sort groups
        const sortedModes = Array.from(groupedMap.keys()).sort((a, b) => {
            const indexA = MODE_ORDER.indexOf(a);
            const indexB = MODE_ORDER.indexOf(b);
            return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
        });

        // 4. Flatten for GroupedVirtuoso
        const flatItems: RSSItem[] = [];
        const groupSizes: number[] = [];
        const groupNames: string[] = [];

        sortedModes.forEach(mode => {
            const groupItems = groupedMap.get(mode)!;
            // Sort items within group: Incidents first, then Active first, then by priority
            groupItems.sort((a, b) => {
                // 1. Incidents first
                if (a.type === 'incident' && b.type !== 'incident') return -1;
                if (a.type !== 'incident' && b.type === 'incident') return 1;

                // 2. Active first
                if (a.isActive && !b.isActive) return -1;
                if (!a.isActive && b.isActive) return 1;

                // 3. High priority first
                const priorityA = a.priority === '1' || a.priority === 'high' ? 1 : 0;
                const priorityB = b.priority === '1' || b.priority === 'high' ? 1 : 0;
                return priorityB - priorityA;
            });

            flatItems.push(...groupItems);
            groupSizes.push(groupItems.length);
            groupNames.push(mode);
        });

        return {
            items: flatItems,
            groupCounts: groupSizes,
            groups: groupNames
        };
    }, [rssData, filterMode, searchQuery]);

    return (
        <Dialog open={isAlertsOpen} onOpenChange={setIsAlertsOpen}>
            <DialogContent aria-describedby={undefined} variant="default" data-testid="alerts-modal-content">
                <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
                    <DialogTitle>
                        {t('alerts.title')}
                    </DialogTitle>
                </DialogHeader>
                
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Header Section */}
                    <div className="pt-1 pb-3 px-6 shrink-0 rounded-none border-b border-white/5 bg-transparent">
                        <div className="flex flex-col gap-3">
                            <Tabs value={filterMode} onValueChange={(v) => setFilterMode(v as 'all' | 'incident' | 'exclusion')}>
                                <TabsList variant="pill" className="w-full grid grid-cols-3">
                                    <TabsTrigger value="all">{t('alerts.all') || 'All'}</TabsTrigger>
                                    <TabsTrigger value="incident">{t('alerts.incidents') || 'Incidents'}</TabsTrigger>
                                    <TabsTrigger value="exclusion">{t('alerts.exclusions') || 'Exclusions'}</TabsTrigger>
                                </TabsList>
                            </Tabs>

                            <div className="relative group">
                                <Input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={t('search.placeholder')}
                                    className="h-10 pl-10 pr-10 text-sm rounded-xl border border-white/5 bg-black/40"
                                />
                                <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={16}  strokeWidth={1.5} />
                                {searchQuery && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                                    >
                                        <X size={16} strokeWidth={1.5}  />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Virtualized List */}
                    <div className="flex-1 min-h-0">
                        {items.length === 0 && !loadingRSS ? (
                            <div className="flex justify-center items-center flex-1 py-12 text-muted-foreground text-sm h-full">
                                <p>{t('alerts.noAlerts')}</p>
                            </div>
                        ) : (
                            <GroupedVirtuoso
                                groupCounts={groupCounts}
                                groupContent={(index) => {
                                    const mode = groups[index];
                                    const count = groupCounts[index];
                                    // Basic translations for mode, fallback to capitalized key
                                    const modeName = t(`transportModes.${mode}`, { defaultValue: mode.charAt(0).toUpperCase() + mode.slice(1) });
                                    
                                    return (
                                        <div className="sticky top-0 bg-background/95 backdrop-blur-md px-6 py-2 border-b border-white/10 shadow-sm z-10">
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                                                    {modeName}
                                                </span>
                                                <span className="text-[10px] font-semibold text-muted-foreground/60 bg-white/5 px-2 py-0.5 rounded-full">
                                                    {count}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                }}
                                itemContent={(index) => {
                                    const item = items[index];
                                    return (
                                        <div className="px-2">
                                            <CondensedAlertItem item={item} />
                                        </div>
                                    );
                                }}
                                className="h-full"
                            />
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

AlertsModal.displayName = 'AlertsModal';

