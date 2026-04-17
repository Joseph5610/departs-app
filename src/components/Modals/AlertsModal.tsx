
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search as SearchIcon, X } from 'lucide-react';
import { usePreferences } from '../../state/MapStateProvider';
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
import { motion, AnimatePresence } from 'framer-motion';
import { getVehicleColor } from '../../../functions/_utils/vehicle-colors';
import { GenericAlertCard } from '../Alerts/GenericAlertCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Stack, Box, Surface } from '@/components/ui/layout';
import { cn } from '@/lib/utils';
import { guessType } from '../../utils/transitUtils';

/**
 * Alerts Component
 *
 * Re-architected with semantic components and shadcn primitives.
 */
export const AlertsModal: React.FC = () => {
    const { t } = useTranslation();
    const { state: prefState, actions: prefActions } = usePreferences();
    const { isAlertsOpen } = prefState;
    const { setIsAlertsOpen } = prefActions;
    
    const [activeTab, setActiveTab] = useState<'incidents' | 'exclusions'>('incidents');
    const [searchQuery, setSearchQuery] = useState('');

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
                                    <span>{t('alerts.incidents')}</span>
                                    {incidentsCount > 0 && (
                                        <Badge
                                            variant={activeTab === 'incidents' ? 'default' : 'destructive'}
                                            className={cn(
                                                "h-4 px-1 rounded-md text-[10px]",
                                                activeTab === 'incidents' ? "bg-destructive text-destructive-foreground hover:bg-destructive" : ""
                                            )}
                                        >
                                            {incidentsCount}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger value="exclusions" className="gap-2">
                                    <span>{t('alerts.exclusions')}</span>
                                    {exclusionsCount > 0 && (
                                        <Badge
                                            variant="status"
                                            className={cn(
                                                "h-4 px-1 rounded-md text-[10px]",
                                                activeTab === 'exclusions' ? 'bg-foreground/20' : ''
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
                                    className="h-10 pl-10 pr-10 text-sm rounded-xl border-2 border-white/10 bg-muted/40"
                                />
                                <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={16} />
                                {searchQuery && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                                    >
                                        <X size={14} />
                                    </Button>
                                )}
                            </Box>
                        </Stack>
                    </Surface>

                    <ScrollArea className="flex-1 min-h-0 px-6">
                        <div className="pt-4 pb-6">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeTab + searchQuery}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <Stack gap={3}>
                                        {currentItems.map((item, idx) => (
                                            <AlertCard key={item.guid || idx} item={item} />
                                        ))}

                                        {currentItems.length === 0 && !loadingRSS && (
                                            <Stack justify="center" align="center" className="flex-1 py-12 text-muted-foreground text-sm min-h-[50vh]">
                                                {t('alerts.noAlerts')}
                                            </Stack>
                                        )}
                                    </Stack>
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </ScrollArea>
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
            lines={item.lines}
            lineColors={(line) => getVehicleColor(guessType(line), line)}
        />
    );
};

AlertCard.displayName = 'AlertCard';
