import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, Activity } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import { useVehicles } from '../../../../hooks/data/useVehicles';
import { useNetworkVehicles } from '../../../../hooks/data/useNetworkVehicles';
import type { VehicleCollection } from '../../../../types/transit';
import { useVehicleMonitor } from '../../../../hooks/derived/useVehicleMonitor';
import type { SearchField } from '../../../../hooks/derived/useVehicleMonitor';
import { VehicleMonitorRow } from './VehicleMonitorRow';
import { SegmentedControl } from '../../../SegmentedControl';
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import { useCityConfig } from '../../../../hooks/data/useCities';
import { routeTypeRank } from '../../../../config/transit';
import { ROUTE_TYPE_ICONS } from '../../../routeTypeIcons';

const modePillClass = (isActive: boolean) => cn(
    "text-xs font-semibold px-3 py-1.5 rounded-full transition-all cursor-pointer shrink-0 border shadow-2xs",
    isActive ? "bg-foreground text-background border-foreground" : "bg-card hover:bg-muted/60 text-foreground border-border/80"
);

export const VehicleMonitorList: React.FC = () => {
    const { t } = useTranslation();
    const cityConfig = useCityConfig();
    const allowedVehicleTypes = React.useMemo(
        () => [...(cityConfig.filters?.vehicles ?? [])].sort((a, b) => routeTypeRank(a) - routeTypeRank(b)),
        [cityConfig.filters?.vehicles],
    );

    const [searchQuery, setSearchQuery] = useState('');
    const [searchField, setSearchField] = useState<SearchField>('line');
    const [modeFilter, setModeFilter] = useState<string>('all');

    const screenVehicles = useVehicles().vehicles;
    const { data: networkVehicles, isFetching: isNetworkFetching } = useNetworkVehicles();

    // Prefer networkVehicles if available, fallback to screenVehicles
    const activeCollection: VehicleCollection | null = (networkVehicles?.features?.length ? networkVehicles : screenVehicles) || screenVehicles || networkVehicles || null;

    const isLoading = (!activeCollection?.features || activeCollection.features.length === 0) && isNetworkFetching;

    const { items, totalCount, modeCounts } = useVehicleMonitor({
        vehiclesCollection: activeCollection,
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

                <SegmentedControl
                    size="sm"
                    value={searchField}
                    onChange={setSearchField}
                    options={[
                        { value: 'line', label: t('stats.monitor.fieldLine') },
                        { value: 'vehicle', label: t('stats.monitor.fieldVehicle') },
                    ]}
                />

                {/* Text Input — no browser chrome */}
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                        searchField === 'vehicle' ? t('stats.monitor.searchByVehicle')
                        : t('stats.monitor.searchByLine')
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
                    className={modePillClass(modeFilter === 'all')}
                >
                    {t('common.all')} ({totalCount})
                </button>

                {allowedVehicleTypes.map(slug => {
                    const count = modeCounts[slug] ?? 0;
                    if (count === 0) return null;
                    const Icon = ROUTE_TYPE_ICONS[slug as keyof typeof ROUTE_TYPE_ICONS];
                    if (!Icon) return null;
                    const isActive = modeFilter === slug;

                    return (
                        <button
                            key={slug}
                            type="button"
                            onClick={() => setModeFilter(isActive ? 'all' : slug)}
                            className={cn(modePillClass(isActive), "flex items-center gap-1.5")}
                        >
                            <Icon size={14} strokeWidth={1.75} />
                            <span>{t(`settings.vehicleTypes.${slug}`)}</span>
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
                    <span className="text-xs font-medium">{t('common.loading')}</span>
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
                <Empty className="py-10 bg-muted/20">
                    <EmptyHeader>
                        <EmptyTitle className="text-xs font-medium text-muted-foreground">
                            {t('stats.monitor.noVehiclesFound')}
                        </EmptyTitle>
                    </EmptyHeader>
                </Empty>
            )}
        </div>
    );
};

VehicleMonitorList.displayName = 'VehicleMonitorList';
