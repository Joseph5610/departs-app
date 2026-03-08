
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Search as SearchIcon, X } from 'lucide-react';
import { useRSS } from '../hooks/useRSS';
import type { RSSItem } from '../types/transit';
import { Modal } from './Modal';
import { motion, AnimatePresence } from 'framer-motion';
import { getVehicleColor } from '../utils/vehicleColors';
import { GenericAlertCard } from './GenericAlertCard';

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
                item.lines?.some(l => l.toLowerCase().includes(searchQuery.toLowerCase()))
              )
            : [...items];

        // Frontend sorting: Priority (Active > Future), then original feed order
        return filtered.sort((a, b) => {
            if (a.isActive && !b.isActive) return -1;
            if (!a.isActive && b.isActive) return 1;
            return 0;
        });
    }, [activeTab, rssData, searchQuery]);

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="p-3 bg-black/90 backdrop-blur-md hover:bg-black/80 active:bg-zinc-800 active:scale-95 text-white rounded-2xl border border-white/10 shadow-2xl transition-all pointer-events-auto group relative"
                title={t('alerts.title')}
            >
                <AlertTriangle size={20} className={incidentsCount > 0 ? "text-rose-500 animate-pulse" : "group-hover:scale-110 transition-transform"} />
                {incidentsCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-black min-w-[20px] text-center">
                        {incidentsCount}
                    </span>
                )}
            </button>

            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={t('alerts.title')}>
                <div className="flex flex-col min-h-0">
                    {/* Sticky Header Section */}
                    <div className="sticky -top-4 z-10 bg-black pt-0 pb-2 space-y-2 -mx-4 px-4 border-b border-white/5">
                        {/* Tabs */}
                        <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
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
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('search.placeholder')}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-8 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            />
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* List */}
                    <div className="space-y-3 pt-0">
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

                                {currentItems.length === 0 && !loadingRSS && (
                                    <div className="flex-1 flex flex-col items-center justify-center py-12 text-zinc-500 text-sm h-full min-h-[50vh]">
                                        {t('alerts.noAlerts')}
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </Modal>
        </>
    );
};

const TabButton: React.FC<{ active: boolean, onClick: () => void, label: string, count: number, isIncident?: boolean }> = ({ active, onClick, label, count, isIncident }) => (
    <button
        onClick={onClick}
        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2
            ${active ? 'bg-white/10 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}
        `}
    >
        <span>{label}</span>
        {count > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${active ? (isIncident ? 'bg-rose-500' : 'bg-white/20') : 'bg-white/5'}`}>
                {count}
            </span>
        )}
    </button>
);

const AlertCard: React.FC<{ item: RSSItem }> = ({ item }) => {
    const { t } = useTranslation();
    // Simple heuristic for transport type to get colors
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
            link={item.link}
            priority={item.priority || 'low'}
            dateFrom={item.date_from}
            dateTo={item.date_from && !item.date_to ? t('alerts.untilFurtherNotice') : item.date_to}
            isActive={item.isActive}
            isFuture={item.isFuture}
            showStatus={true}
            lines={item.lines}
            lineColors={(line) => getVehicleColor(guessType(line), line)}
        />
    );
};
