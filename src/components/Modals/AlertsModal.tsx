
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
    AlertTriangle as AlertIcon,
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
import { CondensedAlertItem } from '../Alerts/CondensedAlertItem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

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

const ModeIcon: React.FC<{ mode: string; className?: string }> = ({ mode, className }) => {
    switch (mode) {
        case 'metro': return <SubwayIcon className={className} size={16} strokeWidth={2} />;
        case 'tram': return <TramIcon className={className} size={16} strokeWidth={2} />;
        case 'bus': case 'trolleybus': return <BusIcon className={className} size={16} strokeWidth={2} />;
        case 'train': return <TrainIcon className={className} size={16} strokeWidth={2} />;
        case 'ferry': return <ShipIcon className={className} size={16} strokeWidth={2} />;
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

    return (
        <Dialog open={isAlertsOpen} onOpenChange={setIsAlertsOpen}>
            <DialogContent aria-describedby={undefined} variant="default" className="max-w-xl" data-testid="alerts-modal-content">
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

                    {/* Scrollable Content */}
                    <ScrollArea className="flex-1 min-h-0 px-6">
                        {sections.length === 0 && !loadingRSS ? (
                            <div className="flex justify-center items-center py-12 text-muted-foreground text-sm">
                                <p>{t('alerts.noAlerts')}</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-6 py-3 pb-6">
                                {sections.map(({ mode, items: modeItems }) => (
                                    <div key={mode} className="flex flex-col gap-2.5">
                                        <div className="sticky top-0 z-10 flex items-center justify-between px-1 py-2 bg-background/90 backdrop-blur-md">
                                            <div className="flex items-center gap-2">
                                                <ModeIcon mode={mode} className="text-primary" />
                                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                                    {t(`transportModes.${mode}`, { defaultValue: mode.charAt(0).toUpperCase() + mode.slice(1) })}
                                                </h3>
                                            </div>
                                            <span className="text-[10px] font-semibold text-muted-foreground bg-foreground/5 border border-border/50 px-2 py-0.5 rounded-full">
                                                {modeItems.length}
                                            </span>
                                        </div>

                                        <Card variant="subtle" size="none" className="overflow-hidden divide-y divide-border/50">
                                            {modeItems.map((item, idx) => (
                                                <CondensedAlertItem key={item.guid || `${item.title}-${idx}`} item={item} />
                                            ))}
                                        </Card>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
};

AlertsModal.displayName = 'AlertsModal';

