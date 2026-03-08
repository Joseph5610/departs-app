
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Search as SearchIcon, X } from 'lucide-react';
import { useRSS } from '../hooks/useRSS';
import type { RSSItem } from '../types/transit';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { getVehicleColor } from '../utils/vehicleColors';
import { GenericAlertCard } from './GenericAlertCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Stack, HStack, Box } from '@/components/ui/layout';
import { cn } from '@/lib/utils';

/**
 * Alerts Component
 *
 * Re-architected with semantic components and shadcn primitives.
 */
export const Alerts: React.FC = () => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'incidents' | 'exclusions'>('incidents');
    const [searchQuery, setSearchQuery] = useState('');

    const { data: rssData, isLoading: loadingRSS } = useRSS();

    const incidentsCount = useMemo(() => rssData?.alerts?.filter(a => a.type === 'incident').length || 0, [rssData]);
    const exclusionsCount = useMemo(() => rssData?.alerts?.filter(a => a.type === 'exclusion').length || 0, [rssData]);

    const currentItems = useMemo(() => {
        const items = rssData?.alerts?.filter(a => activeTab === 'incidents' ? a.type === 'incident' : a.type === 'exclusion');
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
        <>
            <Button
                variant="outline"
                size="icon"
                onClick={() => setIsOpen(true)}
                title={t('alerts.title')}
                className="h-11 w-11 rounded-2xl bg-background/95 backdrop-blur-md shadow-2xl border-border relative"
            >
                <AlertTriangle size={20} className={cn(incidentsCount > 0 ? "text-destructive animate-pulse" : "group-hover:scale-110 transition-transform")} />
                {incidentsCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-background min-w-[20px] text-center">
                        {incidentsCount}
                    </span>
                )}
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {t('alerts.title')}
                        </DialogTitle>
                    </DialogHeader>
                    <Stack className="min-h-0 gap-0">
                        {/* Sticky Header Section */}
                        <Box className="sticky -top-6 z-10 bg-background/95 backdrop-blur-md pt-0 pb-2 -mx-6 px-6 border-b border-border">
                            <Stack className="gap-2">
                                {/* Tabs */}
                                <HStack className="p-1 bg-muted/30 rounded-2xl border border-border">
                                    <TabButton
                                        active={activeTab === 'incidents'}
                                        onClick={() => setActiveTab('incidents')}
                                        label={t('alerts.incidents')}
                                        count={incidentsCount}
                                        isIncident={true}
                                    />
                                    <TabButton
                                        active={activeTab === 'exclusions'}
                                        onClick={() => setActiveTab('exclusions')}
                                        label={t('alerts.exclusions')}
                                        count={exclusionsCount}
                                    />
                                </HStack>

                                {/* Search */}
                                <Box className="relative group">
                                    <Input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder={t('search.placeholder')}
                                        className="h-9 pl-9 pr-8 text-sm"
                                    />
                                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={14} />
                                    {searchQuery && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                                        >
                                            <X size={14} />
                                        </Button>
                                    )}
                                </Box>
                            </Stack>
                        </Box>

                        {/* List */}
                        <Box className="pt-4">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeTab + searchQuery}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <Stack className="gap-3">
                                        {currentItems.map((item, idx) => (
                                            <AlertCard key={item.guid || idx} item={item} />
                                        ))}

                                        {currentItems.length === 0 && !loadingRSS && (
                                            <Stack className="flex-1 items-center justify-center py-12 text-muted-foreground text-sm min-h-[50vh] gap-0">
                                                {t('alerts.noAlerts')}
                                            </Stack>
                                        )}
                                    </Stack>
                                </motion.div>
                            </AnimatePresence>
                        </Box>
                    </Stack>
                </DialogContent>
            </Dialog>
        </>
    );
};

const TabButton: React.FC<{ active: boolean, onClick: () => void, label: string, count: number, isIncident?: boolean }> = ({ active, onClick, label, count, isIncident }) => (
    <Button
        variant={active ? "secondary" : "ghost"}
        onClick={onClick}
        className={cn(
            "flex-1 h-9 rounded-xl text-xs font-bold gap-2",
            !active && "text-muted-foreground hover:text-foreground"
        )}
    >
        <span>{label}</span>
        {count > 0 && (
            <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px]",
                active ? (isIncident ? 'bg-rose-500 text-white' : 'bg-foreground/20') : 'bg-muted'
            )}>
                {count}
            </span>
        )}
    </Button>
);

const AlertCard: React.FC<{ item: RSSItem }> = ({ item }) => {
    const { t } = useTranslation();
    const guessType = (line: string) => {
        if (['A', 'B', 'C'].includes(line.toUpperCase())) return 'metro';
        const n = parseInt(line);
        if (!isNaN(n)) {
            if (n < 40) return 'tram';
            if (n >= 100 && n < 900) return 'bus';
            if (n >= 900) return 'bus';
        }
        return 'bus';
    };

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
