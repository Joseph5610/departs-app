
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ExternalLink, Search as SearchIcon, X } from 'lucide-react';
import { useRSS } from '../hooks/useRSS';
import type { RSSItem } from '../hooks/useRSS';
import { motion, AnimatePresence } from 'framer-motion';
import { getVehicleColor } from '../utils/vehicleColors';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ControlGroup, ControlButton } from "@/components/ui/map";

export const Alerts: React.FC = () => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'incidents' | 'exclusions'>('incidents');
    const [searchQuery, setSearchQuery] = useState('');

    const { data: incidents, isLoading: loadingIncidents } = useRSS('incidents');
    const { data: exclusions, isLoading: loadingExclusions } = useRSS('exclusions');

    const incidentsCount = incidents?.items?.length || 0;
    const exclusionsCount = exclusions?.items?.length || 0;

    const currentItems = useMemo(() => {
        const items = activeTab === 'incidents' ? incidents?.items : exclusions?.items;
        if (!items) return [];
        if (!searchQuery.trim()) return items;

        const q = searchQuery.toLowerCase();
        return items.filter(item =>
            item.title.toLowerCase().includes(q) ||
            item.lines?.some(l => l.toLowerCase().includes(q))
        );
    }, [activeTab, incidents, exclusions, searchQuery]);

    return (
        <>
            <ControlGroup>
                <ControlButton
                    onClick={() => setIsOpen(true)}
                    label={t('alerts.title')}
                >
                    <div className="relative">
                        <AlertTriangle size={16} className={incidentsCount > 0 ? "text-rose-500 animate-pulse" : ""} />
                        {incidentsCount > 0 && (
                            <Badge className="absolute -top-3 -right-3 bg-rose-600 text-white text-[9px] font-bold px-1 py-0 rounded-full border border-black min-w-[16px] h-4 flex items-center justify-center">
                                {incidentsCount}
                            </Badge>
                        )}
                    </div>
                </ControlButton>
            </ControlGroup>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-[500px] bg-black/95 backdrop-blur-xl border-white/10 text-white rounded-[2rem] p-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle className="text-xl font-bold">{t('alerts.title')}</DialogTitle>
                    </DialogHeader>

                    <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as any)} className="w-full">
                        <div className="px-6 pb-4 space-y-4">
                            <TabsList className="grid grid-cols-2 bg-white/5 border border-white/5 rounded-2xl h-11 p-1">
                                <TabsTrigger value="incidents" className="rounded-xl data-[state=active]:bg-white/10 data-[state=active]:text-white gap-2 text-zinc-500 font-bold">
                                    {t('alerts.incidents')}
                                    {incidentsCount > 0 && <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-rose-500 text-white border-none">{incidentsCount}</Badge>}
                                </TabsTrigger>
                                <TabsTrigger value="exclusions" className="rounded-xl data-[state=active]:bg-white/10 data-[state=active]:text-white gap-2 text-zinc-500 font-bold">
                                    {t('alerts.exclusions')}
                                    {exclusionsCount > 0 && <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-white/20 text-white border-none">{exclusionsCount}</Badge>}
                                </TabsTrigger>
                            </TabsList>

                            <div className="relative">
                                <Input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={t('search.placeholder')}
                                    className="w-full h-10 bg-white/5 border-white/10 pl-9 pr-8 text-sm focus-visible:ring-emerald-500/50 rounded-xl"
                                />
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
                                {searchQuery && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-zinc-500 hover:text-white"
                                    >
                                        <X size={14} />
                                    </Button>
                                )}
                            </div>
                        </div>

                        <ScrollArea className="max-h-[60vh] px-6 pb-6">
                            <div className="space-y-3">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={activeTab + searchQuery}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-3"
                                    >
                                        {currentItems.map((item, idx) => (
                                            <AlertCard key={item.guid || idx} item={item} />
                                        ))}

                                        {currentItems.length === 0 && !loadingIncidents && !loadingExclusions && (
                                            <div className="flex flex-col items-center justify-center py-12 text-zinc-500 text-sm">
                                                {t('alerts.noAlerts')}
                                            </div>
                                        )}
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        </ScrollArea>
                    </Tabs>
                </DialogContent>
            </Dialog>
        </>
    );
};

const AlertCard: React.FC<{ item: RSSItem }> = ({ item }) => {
    const { t } = useTranslation();
    const isFuture = item.isFuture;
    const isActive = item.isActive;

    const guessType = (line: string) => {
        if (['A', 'B', 'C'].includes(line.toUpperCase())) return 'metro';
        const n = parseInt(line);
        if (!isNaN(n)) {
            if (n < 40) return 'tram';
            if (n >= 100 && n < 900) return 'bus';
        }
        return 'bus';
    };

    return (
        <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
                "block p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all group relative overflow-hidden",
                item.priority === '1' && 'border-rose-500/30 bg-rose-500/5',
                isFuture && 'opacity-60 grayscale-[0.3]'
            )}
        >
            {item.priority === '1' && (
                <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
            )}

            <div className="flex flex-col gap-3">
                <div className="flex justify-between items-start gap-4">
                    <div className="flex flex-col gap-1.5">
                        {isFuture ? (
                            <span className="text-[9px] font-black text-rose-500/80 uppercase tracking-widest flex items-center gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-rose-500 animate-pulse" />
                                {t('alerts.planned')}
                            </span>
                        ) : isActive ? (
                            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                {t('alerts.active')}
                            </span>
                        ) : null}
                        <div className="text-white font-bold text-sm leading-tight group-hover:text-emerald-400 transition-colors">
                            {item.title}
                        </div>
                    </div>
                    <ExternalLink size={14} className="text-zinc-600 group-hover:text-zinc-400 shrink-0 mt-0.5" />
                </div>

                {item.lines && item.lines.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {item.lines.map(line => (
                            <Badge
                                key={line}
                                className="px-2 py-0.5 rounded-md text-[10px] font-black text-white shadow-sm border-none"
                                style={{ backgroundColor: getVehicleColor(guessType(line), line) }}
                            >
                                {line}
                            </Badge>
                        ))}
                    </div>
                )}

                {(item.date || item.pubDate) && (
                    <div className="text-zinc-500 text-[10px] font-medium flex items-center gap-2">
                        <span>{item.date || new Date(item.pubDate).toLocaleDateString()}</span>
                    </div>
                )}
            </div>
        </a>
    );
};
