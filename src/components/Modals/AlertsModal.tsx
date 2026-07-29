
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Search as SearchIcon,
    X,
    TrainFront as SubwayIcon,
    Bus as BusIcon,
    TramFront as TramIcon,
    Train as TrainIcon,
    Ship as ShipIcon,
    CableCar as CableCarIcon,
    AlertTriangle as AlertIcon,
    CheckCircle2,
} from 'lucide-react';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useGlobalAlerts } from '../../hooks/data/useGlobalAlerts';
import type { RSSItem } from '../../types/transit';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GroupedVirtuoso } from 'react-virtuoso';
import { CondensedAlertItem } from '../Alerts/CondensedAlertItem';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Empty,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
    EmptyDescription,
} from '@/components/ui/empty';

// Helper to determine the primary transport mode of an alert
const getTransportMode = (item: RSSItem): string => {
    if (!item.line_metadata || item.line_metadata.length === 0) return 'other';

    for (const meta of item.line_metadata) {
        const rawType = String(meta.type || '').toLowerCase();
        const typeNum = Number(rawType);

        if (rawType === '1' || typeNum === 1 || rawType === 'metro') return 'metro';
        if (rawType === '0' || typeNum === 0 || (typeNum >= 900 && typeNum <= 999) || rawType === 'tram') return 'tram';
        if (rawType === '4' || typeNum === 4 || (typeNum >= 1000 && typeNum <= 1099) || rawType === 'ferry') return 'ferry';
        if (rawType === '7' || typeNum === 7 || (typeNum >= 1400 && typeNum <= 1499) || rawType === 'funicular') return 'funicular';
        if (rawType === '3' || rawType === '11' || typeNum === 3 || typeNum === 11 || (typeNum >= 700 && typeNum <= 899) || rawType === 'bus' || rawType === 'trolleybus') return 'bus';
        if (rawType === '2' || typeNum === 2 || (typeNum >= 100 && typeNum <= 199) || rawType === 'train') return 'train';
    }

    return 'other';
};

const MODE_ORDER = ['metro', 'tram', 'bus', 'train', 'ferry', 'funicular', 'other'];

const ModeIcon: React.FC<{ mode: string; className?: string }> = ({ mode, className }) => {
    switch (mode) {
        case 'metro': return <SubwayIcon className={className} size={16} strokeWidth={2} />;
        case 'tram': return <TramIcon className={className} size={16} strokeWidth={2} />;
        case 'bus': case 'trolleybus': return <BusIcon className={className} size={16} strokeWidth={2} />;
        case 'train': return <TrainIcon className={className} size={16} strokeWidth={2} />;
        case 'ferry': return <ShipIcon className={className} size={16} strokeWidth={2} />;
        case 'funicular': return <CableCarIcon className={className} size={16} strokeWidth={2} />;
        default: return <AlertIcon className={className} size={16} strokeWidth={2} />;
    }
};

/**
 * AlertsModal Component
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
    const sections = useMemo(() => {
        const rawItems = rssData?.alerts || [];

        // 1. Filter
        const filtered = rawItems.filter(item => {
            if (filterMode === 'incident' && item.type !== 'incident') return false;
            if (filterMode === 'exclusion' && item.type !== 'exclusion') return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchesTitle = item.title.toLowerCase().includes(q);
                const matchesDesc = item.description?.toLowerCase().includes(q);
                const matchesLine = item.lines?.some((l: string) => l.toLowerCase().includes(q));
                if (!matchesTitle && !matchesDesc && !matchesLine) return false;
            }
            return true;
        });

        // 2. Group
        const groupedMap = new Map<string, RSSItem[]>();
        filtered.forEach(item => {
            const mode = getTransportMode(item);
            if (!groupedMap.has(mode)) groupedMap.set(mode, []);
            groupedMap.get(mode)!.push(item);
        });

        // 3. Sort groups and items
        const sortedModes = Array.from(groupedMap.keys()).sort((a, b) => {
            const indexA = MODE_ORDER.indexOf(a);
            const indexB = MODE_ORDER.indexOf(b);
            return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
        });

        // 4. Create mode sections
        return sortedModes.map(mode => {
            const groupItems = groupedMap.get(mode)!;
            groupItems.sort((a, b) => {
                if (a.type === 'incident' && b.type !== 'incident') return -1;
                if (a.type !== 'incident' && b.type === 'incident') return 1;

                if (a.isActive && !b.isActive) return -1;
                if (!a.isActive && b.isActive) return 1;

                const priorityA = a.priority === '1' || a.priority === 'high' ? 1 : 0;
                const priorityB = b.priority === '1' || b.priority === 'high' ? 1 : 0;
                return priorityB - priorityA;
            });
            return { mode, items: groupItems };
        });
    }, [rssData, filterMode, searchQuery]);

    const groupCounts = useMemo(() => sections.map(s => s.items.length), [sections]);
    const groupModes = useMemo(() => sections.map(s => s.mode), [sections]);
    const flatItems = useMemo(() => sections.flatMap(s => s.items), [sections]);

    const itemGroupMeta = useMemo(() => {
        const meta: { itemIndexInGroup: number; countInGroup: number }[] = [];
        groupCounts.forEach((count) => {
            for (let i = 0; i < count; i++) {
                meta.push({
                    itemIndexInGroup: i,
                    countInGroup: count,
                });
            }
        });
        return meta;
    }, [groupCounts]);

    return (
        <Dialog open={isAlertsOpen} onOpenChange={setIsAlertsOpen}>
            <DialogContent aria-describedby={undefined} variant="default" className="max-w-xl flex flex-col h-[calc(85dvh)] p-0 overflow-hidden gap-0" data-testid="alerts-modal-content">
                <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
                    <DialogTitle>
                        {t('alerts.title')}
                    </DialogTitle>
                </DialogHeader>
                
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Header Section */}
                    <div className="pt-1 pb-3 px-6 shrink-0 border-b border-border/50 bg-transparent">
                        <div className="flex flex-col gap-3">
                            <Tabs value={filterMode} onValueChange={(v) => setFilterMode(v as 'all' | 'incident' | 'exclusion')}>
                                <TabsList variant="pill" className="w-full grid grid-cols-3">
                                    <TabsTrigger value="all" className="cursor-pointer">{t('alerts.all') || 'All'}</TabsTrigger>
                                    <TabsTrigger value="incident" className="cursor-pointer">{t('alerts.incidents') || 'Incidents'}</TabsTrigger>
                                    <TabsTrigger value="exclusion" className="cursor-pointer">{t('alerts.exclusions') || 'Exclusions'}</TabsTrigger>
                                </TabsList>
                            </Tabs>

                            <div className="relative group">
                                <Input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={t('search.placeholder')}
                                    className="h-10 pl-10 pr-10 text-sm rounded-xl border border-border/80 bg-card focus-visible:ring-primary/40 transition-colors"
                                />
                                <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={16} strokeWidth={1.5} />
                                {searchQuery && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                                    >
                                        <X size={16} strokeWidth={1.5} />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Virtualized Scroll Container */}
                    <div className="flex-1 min-h-0 px-6 py-2">
                        {sections.length === 0 && !loadingRSS ? (
                            <div className="flex flex-1 items-center justify-center py-12 h-full">
                                <Empty className="animate-in fade-in zoom-in-95 duration-300">
                                    <EmptyHeader>
                                        <EmptyMedia
                                            variant="icon"
                                            className="size-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.12)] [&_svg:not([class*='size-'])]:size-7"
                                        >
                                            <CheckCircle2 strokeWidth={1.5} />
                                        </EmptyMedia>
                                        <EmptyTitle className="text-base font-bold text-foreground/90">
                                            {t('alerts.noAlerts')}
                                        </EmptyTitle>
                                        <EmptyDescription className="text-sm max-w-64">
                                            {searchQuery.trim()
                                                ? t('alerts.noAlertsSearchDescription')
                                                : t('alerts.noAlertsDescription')
                                            }
                                        </EmptyDescription>
                                    </EmptyHeader>
                                </Empty>
                            </div>
                        ) : (
                            <GroupedVirtuoso
                                style={{ height: '100%' }}
                                groupCounts={groupCounts}
                                groupContent={(index) => {
                                    const mode = groupModes[index];
                                    const count = groupCounts[index];
                                    return (
                                        <div className="sticky top-0 z-10 flex items-center justify-between px-1 py-2 bg-background/95 backdrop-blur-md">
                                            <div className="flex items-center gap-2">
                                                <ModeIcon mode={mode} className="text-primary" />
                                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                                    {t(`transportModes.${mode}`, { defaultValue: mode.charAt(0).toUpperCase() + mode.slice(1) })}
                                                </h3>
                                            </div>
                                            <Badge variant="outline" className="text-[10px] font-mono font-bold bg-foreground/5 border-border/40 text-muted-foreground px-2 py-0.5 rounded-full">
                                                {count}
                                            </Badge>
                                        </div>
                                    );
                                }}
                                itemContent={(index) => {
                                    const item = flatItems[index];
                                    const { itemIndexInGroup, countInGroup } = itemGroupMeta[index] || { itemIndexInGroup: 0, countInGroup: 1 };
                                    const isFirst = itemIndexInGroup === 0;
                                    const isLast = itemIndexInGroup === countInGroup - 1;

                                    return (
                                        <div
                                            className={cn(
                                                "bg-card/70 backdrop-blur-xs border-x border-border/40 transition-colors overflow-hidden",
                                                isFirst && "rounded-t-2xl border-t mt-1.5",
                                                isLast && "rounded-b-2xl border-b mb-3 shadow-xs",
                                                !isLast && "border-b border-border/40"
                                            )}
                                        >
                                            <CondensedAlertItem item={item} />
                                        </div>
                                    );
                                }}
                            />
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

AlertsModal.displayName = 'AlertsModal';

