
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

    const incidentsCount = useMemo(() => { return rssData?.alerts?.filter((a) => { return a.type === 'incident'; }).length || 0; }, [rssData]);
    const exclusionsCount = useMemo(() => { return rssData?.alerts?.filter((a) => { return a.type === 'exclusion'; }).length || 0; }, [rssData]);

    const currentItems = useMemo(() => {
        const items = rssData?.alerts?.filter((a) => { return activeTab === 'incidents' ? a.type === 'incident' : a.type === 'exclusion'; });
        if (!items) return [];

        const filtered = searchQuery.trim()
            ? items.filter(item =>
                item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
                item.lines?.some(l => l.toLowerCase().includes(searchQuery.toLowerCase()))
              )
            : [...items];

        return filtered.sort((a, b) => {
            if (a.isActive && !b.isActive) return -1;
            if (!a.isActive && b.isActive) return 1;
            return 0;
        });
    }, [activeTab, rssData, searchQuery]);

    const rowVirtualizer = useVirtualizer({
        count: currentItems.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 140, // Estimated height of GenericAlertCard
        overscan: 5,
    });

    // Reset scroll when tab or search changes
    useEffect(() => {
        rowVirtualizer.scrollToOffset(0);
    }, [activeTab, searchQuery, rowVirtualizer]);

    return (
        <Dialog open={isAlertsOpen} onOpenChange={setIsAlertsOpen}>
            <DialogContent aria-describedby={undefined} variant="tinted" data-testid="alerts-modal-content" className="flex flex-col h-[calc(100dvh-5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] p-0 overflow-hidden gap-0">
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
                                    <span className="text-xs uppercase tracking-wide font-black">
                                        {t('alerts.incidents')}
                                    </span>
                                    {incidentsCount > 0 && (
                                        <Badge
                                            variant="destructive"
                                            className={cn(
                                                "h-4 px-1 rounded-md text-[9px] font-black",
                                                activeTab !== 'incidents' && "opacity-50 grayscale"
                                            )}
                                        >
                                            {incidentsCount}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger value="exclusions" className="gap-2">
                                    <span className="text-xs uppercase tracking-wide font-black">
                                        {t('alerts.exclusions')}
                                    </span>
                                    {exclusionsCount > 0 && (
                                        <Badge
                                            variant="secondary"
                                            className={cn(
                                                "h-4 px-1 rounded-md text-[9px] font-black",
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
                        className="flex-1 min-h-0 overflow-y-auto px-6 custom-scrollbar"
                    >
                        {currentItems.length > 0 ? (
                            <div
                                style={{
                                    height: `${rowVirtualizer.getTotalSize()}px`,
                                    width: '100%',
                                    position: 'relative',
                                }}
                            >
                                {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                                    const item = currentItems[virtualItem.index];
                                    return (
                                        <div
                                            key={virtualItem.key}
                                            data-index={virtualItem.index}
                                            ref={rowVirtualizer.measureElement}
                                            className="absolute top-0 left-0 w-full"
                                            style={{
                                                transform: `translateY(${virtualItem.start}px)`,
                                                paddingBottom: '12px', // Gap between cards
                                                paddingTop: virtualItem.index === 0 ? '16px' : '0', // Initial padding
                                            }}
                                        >
                                            <AlertCard item={item} />
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            !loadingRSS && (
                                <Stack justify="center" align="center" className="flex-1 py-12 text-muted-foreground text-sm min-h-[50vh]">
                                    <p>{t('alerts.noAlerts')}</p>
                                </Stack>
                            )
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
