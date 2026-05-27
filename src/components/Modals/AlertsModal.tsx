
import React, { useState, useMemo, useRef, useEffect } from 'react';
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
import { Badge } from "@/components/ui/badge";
import { useVirtualizer } from '@tanstack/react-virtual';
import { GenericAlertCard } from '../Alerts/GenericAlertCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Stack, Box, Surface } from '@/components/ui/layout';
import { cn } from '@/lib/utils';

/**
 * Alerts Component
 *
 * Re-architected with semantic components and shadcn primitives.
 */
export const AlertsModal: React.FC = () => {
    const { t } = useTranslation();

    // Preferences
    const isAlertsOpen = usePreferencesStore(s => s.isAlertsOpen);
    const { setIsAlertsOpen } = usePreferencesStore(s => s.actions);
    
    const [activeTab, setActiveTab] = useState<'incidents' | 'exclusions'>('incidents');
    const [searchQuery, setSearchQuery] = useState('');

    const parentRef = useRef<HTMLDivElement>(null);

    const { rss } = useGlobalAlerts();
    const { data: rssData, isLoading: loadingRSS } = rss;

    const { incidents, exclusions } = useMemo(() => {
        const alerts = rssData?.alerts || [];
        return {
            incidents: alerts.filter(a => a.type === 'incident').sort((a, b) => (a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1)),
            exclusions: alerts.filter(a => a.type === 'exclusion').sort((a, b) => (a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1))
        };
    }, [rssData]);

    const incidentsCount = incidents.length;
    const exclusionsCount = exclusions.length;

    const currentItems = useMemo(() => {
        const items = activeTab === 'incidents' ? incidents : exclusions;
        const query = searchQuery.trim().toLowerCase();

        if (!query) return items;

        return items.filter(item =>
            item.title.toLowerCase().includes(query) ||
            (item.description && item.description.toLowerCase().includes(query)) ||
            item.lines?.some(l => l.toLowerCase().includes(query))
        );
    }, [activeTab, incidents, exclusions, searchQuery]);

    const rowVirtualizer = useVirtualizer(useMemo(() => ({
        count: currentItems.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 140,
        overscan: 5,
    }), [currentItems.length]));

    // Reset scroll when tab or search changes
    useEffect(() => {
        if (parentRef.current) {
            parentRef.current.scrollTop = 0;
        }
    }, [activeTab, searchQuery]);

    return (
        <Dialog open={isAlertsOpen} onOpenChange={setIsAlertsOpen}>
            <DialogContent aria-describedby={undefined} variant="tinted" data-testid="alerts-modal-content" className="flex flex-col h-[calc(100dvh-5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] p-0 max-w-2xl overflow-hidden gap-0">
                <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
                    <DialogTitle>
                        {t('alerts.title')}
                    </DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="incidents" value={activeTab} onValueChange={(v) => setActiveTab(v as 'incidents' | 'exclusions')} className="flex-1 flex flex-col min-h-0">
                    {/* Header Section */}
                    <Surface variant="ghost" padding="none" className="pt-1 pb-3 px-6 shrink-0 rounded-none">
                        <Stack gap={2}>
                            <TabsList variant="pill">
                                <TabsTrigger value="incidents" className="gap-2">
                                    <span className="text-xs uppercase tracking-wide font-semibold">
                                        {t('alerts.incidents')}
                                    </span>
                                    {incidentsCount > 0 && (
                                        <Badge
                                            variant="destructive"
                                            className={cn(
                                                "h-4 px-1 rounded-md text-[10px] font-semibold",
                                                activeTab !== 'incidents' && "opacity-50 grayscale"
                                            )}
                                        >
                                            {incidentsCount}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger value="exclusions" className="gap-2">
                                    <span className="text-xs uppercase tracking-wide font-semibold">
                                        {t('alerts.exclusions')}
                                    </span>
                                    {exclusionsCount > 0 && (
                                        <Badge
                                            variant="secondary"
                                            className={cn(
                                                "h-4 px-1 rounded-md text-[10px] font-semibold",
                                                activeTab !== 'exclusions' && "opacity-50"
                                            )}
                                        >
                                            {exclusionsCount}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                            </TabsList>

                            <Box className="relative group">
                                <Input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={t('search.placeholder')}
                                    className="h-10 pl-10 pr-10 text-sm rounded-xl border-white/10 bg-white/5 focus:bg-white/10 transition-all"
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
                            </Box>
                        </Stack>
                    </Surface>

                    <Box
                        ref={parentRef}
                        className="flex-1 min-h-0 overflow-y-auto px-6 pt-2 pb-6 custom-scrollbar"
                    >
                        {loadingRSS ? (
                             <Stack justify="center" align="center" className="flex-1 py-12 min-h-[50vh]">
                                <Box className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                             </Stack>
                        ) : currentItems.length > 0 ? (
                            <div
                                style={{
                                    height: `${rowVirtualizer.getTotalSize()}px`,
                                    width: '100%',
                                    position: 'relative',
                                }}
                            >
                                {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                                    const item = currentItems[virtualItem.index];
                                    if (!item) return null;

                                    return (
                                        <div
                                            key={`${activeTab}-${virtualItem.index}`}
                                            data-index={virtualItem.index}
                                            ref={rowVirtualizer.measureElement}
                                            className="absolute top-0 left-0 w-full py-[6px]"
                                            style={{
                                                transform: `translateY(${virtualItem.start}px)`,
                                            }}
                                        >
                                            <AlertCard item={item} />
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <Stack justify="center" align="center" className="flex-1 py-12 text-muted-foreground text-sm min-h-[50vh]">
                                <p>{t('alerts.noAlerts')}</p>
                            </Stack>
                        )}
                    </Box>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};

AlertsModal.displayName = 'AlertsModal';


const AlertCard: React.FC<{ item: RSSItem }> = ({ item }) => {
    const { t } = useTranslation();

    return (
        <GenericAlertCard
            title={item.title}
            description={item.description}
            link={item.link}
            priority={item.priority || 'low'}
            validFrom={item.valid_from}
            validTo={item.valid_from && !item.valid_to ? t('alerts.untilFurtherNotice') : item.valid_to}
            isActive={item.isActive}
            isFuture={item.isFuture}
            showStatus={true}
            lines={item.line_metadata}
        />
    );
};

AlertCard.displayName = 'AlertCard';
