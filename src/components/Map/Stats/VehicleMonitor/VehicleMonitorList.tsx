import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, Activity } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import { useVehicles } from '../../../../hooks/data/useVehicles';
import { useNetworkVehicles } from '../../../../hooks/data/useNetworkVehicles';
import type { VehicleCollection } from '../../../../types/transit';
import { useVehicleMonitor } from '../../../../hooks/derived/useVehicleMonitor';
import type { SearchField } from '../../../../hooks/derived/useVehicleMonitor';
import { VehicleMonitorRow } from './VehicleMonitorRow';
import { cn } from '@/lib/utils';
import { usePreferencesStore } from '../../../../state/preferencesStore';
import { useEnrichmentStore } from '../../../../state/enrichmentStore';
import { applyEnrichment } from '../../../../lib/enrichment';
import { getCityConfig } from '../../../../config/cities';

/** Maps a cityConfig vehicle type slug → { emoji, i18nKey, label } */
const VEHICLE_TYPE_META: Record<string, { emoji: string; i18nKey: string; label: string }> = {
    metro:      { emoji: '🚇', i18nKey: 'settings.vehicleTypes.metro',      label: 'Metro'     },
    tram:       { emoji: '🚋', i18nKey: 'settings.vehicleTypes.tram',       label: 'Tramvaje'  },
    bus:        { emoji: '🚌', i18nKey: 'settings.vehicleTypes.bus',        label: 'Autobusy'  },
    trolleybus: { emoji: '🚎', i18nKey: 'settings.vehicleTypes.trolleybus', label: 'Trolejbusy' },
    train:      { emoji: '🚆', i18nKey: 'settings.vehicleTypes.train',      label: 'Vlaky'     },
    ferry:      { emoji: '⛴️', i18nKey: 'settings.vehicleTypes.ferry',      label: 'Přívoz'    },
    funicular:  { emoji: '🚡', i18nKey: 'settings.vehicleTypes.funicular',  label: 'Lanovka'   },
};

export const VehicleMonitorList: React.FC = () => {
    const { t } = useTranslation();
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const cityConfig = getCityConfig(selectedCity);
    const allowedVehicleTypes = cityConfig.filters?.vehicles ?? [];

    const [searchQuery, setSearchQuery] = useState('');
    const [searchField, setSearchField] = useState<SearchField>('line');
    const [modeFilter, setModeFilter] = useState<string>('all');

    const screenVehicles = useVehicles().vehicles;
    const { data: networkVehicles, isFetching: isNetworkFetching } = useNetworkVehicles();
    const byTripId = useEnrichmentStore(s => s.byTripId);
    const byVehicleId = useEnrichmentStore(s => s.byVehicleId);

    // Prefer networkVehicles if available, fallback to screenVehicles
    const activeCollection: VehicleCollection | null = (networkVehicles?.features?.length ? networkVehicles : screenVehicles) || screenVehicles || networkVehicles || null;

    // Apply live WebSocket enrichment to active vehicle collection (e.g. KORDIS/Brno delays)
    const enrichedCollection = useMemo(() => {
        if (!activeCollection?.features?.length) return activeCollection;
        const enrichedFeatures = activeCollection.features.map(f => {
            const vehicleId = f.properties.vehicle_id || f.properties.vehicle_descriptor?.vehicle_registration_number?.toString() || undefined;
            const p = applyEnrichment(
                f.properties,
                f.properties.gtfs_trip_id,
                vehicleId,
                byTripId,
                byVehicleId,
                0
            );
            return p === f.properties ? f : { ...f, properties: p };
        });
        return { ...activeCollection, features: enrichedFeatures };
    }, [activeCollection, byTripId, byVehicleId]);

    const isLoading = (!activeCollection?.features || activeCollection.features.length === 0) && isNetworkFetching;

    const { items, totalCount, modeCounts } = useVehicleMonitor({
        vehiclesCollection: enrichedCollection,
        searchQuery,
        searchField,
        modeFilter,
        sortBy: 'line'
    });

    return (
        <div className="flex flex-col gap-2.5 pt-1 pb-2">
            {/* Search Bar with inline field selector */}
            <div className="flex items-center gap-2 h-10 px-3 rounded-xl border border-border/60 bg-card/60 transition-all">
                <Search size={14} className="text-muted-foreground/50 shrink-0" />

                {/* Field Selector Pills — Linka / Ev. č. */}
                <div className="flex items-center gap-0.5 bg-muted/30 p-0.5 rounded-lg shrink-0">
                    {([
                        { value: 'line',    label: t('stats.monitor.fieldLine', 'Linka') },
                        { value: 'vehicle', label: t('stats.monitor.fieldVehicle', 'Ev. č.') },
                    ] as { value: SearchField; label: string }[]).map(({ value, label }) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setSearchField(value)}
                            className={cn(
                                "text-[11px] font-semibold px-2 py-0.5 rounded-md transition-all cursor-pointer shrink-0",
                                searchField === value
                                    ? "bg-background text-foreground shadow-2xs"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* Text Input — no browser chrome */}
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                        searchField === 'vehicle' ? t('stats.monitor.searchByVehicle', 'Ev. číslo...')
                        : t('stats.monitor.searchByLine', 'Číslo linky...')
                    }
                    className="flex-1 min-w-0 bg-transparent text-sm outline-none ring-0 border-0 focus:outline-none focus:ring-0 placeholder:text-muted-foreground/40"
                />

                {searchQuery && (
                    <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="text-muted-foreground/50 hover:text-foreground cursor-pointer shrink-0 transition-colors"
                    >
                        <X size={13} />
                    </button>
                )}
            </div>

            {/* Mode Filter Pills — ordered by cityConfig.filters.vehicles */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                {/* "Vše" always first */}
                <button
                    type="button"
                    onClick={() => setModeFilter('all')}
                    className={cn(
                        "text-xs font-semibold px-3 py-1.5 rounded-full transition-all cursor-pointer shrink-0 border",
                        modeFilter === 'all'
                            ? "bg-foreground text-background border-foreground shadow-2xs"
                            : "bg-card hover:bg-muted/60 text-foreground border-border/80 shadow-2xs"
                    )}
                >
                    {t('common.all', 'Vše')} ({totalCount})
                </button>

                {allowedVehicleTypes.map(slug => {
                    const count = modeCounts[slug] ?? 0;
                    if (count === 0) return null;
                    const meta = VEHICLE_TYPE_META[slug];
                    if (!meta) return null;
                    const isActive = modeFilter === slug;

                    return (
                        <button
                            key={slug}
                            type="button"
                            onClick={() => setModeFilter(isActive ? 'all' : slug)}
                            className={cn(
                                "text-xs font-semibold px-3 py-1.5 rounded-full transition-all cursor-pointer shrink-0 flex items-center gap-1.5 border",
                                isActive
                                    ? "bg-foreground text-background border-foreground shadow-2xs"
                                    : "bg-card hover:bg-muted/60 text-foreground border-border/80 shadow-2xs"
                            )}
                        >
                            <span>{meta.emoji}</span>
                            <span>{t(meta.i18nKey, meta.label)}</span>
                            <span className="text-[10px] opacity-75">({count})</span>
                        </button>
                    );
                })}
            </div>

            {/* Results Counter */}
            <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                <span>
                    {t('stats.monitor.showingCount', { count: items.length, total: totalCount })}
                </span>
            </div>

            {/* Virtuoso Virtualized High-Density Tabular List */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground opacity-60">
                    <Activity className="animate-pulse" size={24} />
                    <span className="text-xs font-medium">{t('common.loading', 'Načítání...')}</span>
                </div>
            ) : items.length > 0 ? (
                <div className="border border-border/30 rounded-xl overflow-hidden bg-card/20 h-[520px] max-h-[60vh]">
                    <Virtuoso
                        style={{ height: '100%' }}
                        data={items}
                        itemContent={(_index, item) => (
                            <VehicleMonitorRow key={item.id} item={item} />
                        )}
                    />
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-xs text-center border border-dashed rounded-xl p-6 bg-muted/20">
                    <span>{t('stats.monitor.noVehiclesFound', 'Žádná vozidla neodpovídají zadaným filtrům.')}</span>
                </div>
            )}
        </div>
    );
};

VehicleMonitorList.displayName = 'VehicleMonitorList';
