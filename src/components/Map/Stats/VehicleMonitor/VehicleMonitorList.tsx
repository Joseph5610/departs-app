import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Bus } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import { useVehicles } from '@/hooks/data/useVehicles';
import { useVehicleMonitor } from '@/hooks/derived/useVehicleMonitor';
import type { SearchField as VehicleSearchField } from '@/domain/vehicles';
import { VehicleMonitorRow } from './VehicleMonitorRow';
import { FilterChip } from '@/components/FilterChip';
import { useCityConfig } from '@/hooks/data/useCities';
import { routeTypeRank } from '@/domain/routes';
import { ROUTE_TYPE_ICONS } from '@/components/routeTypeIcons';
import { SearchField } from '@/components/SearchField';
import { EmptyState } from '@/components/EmptyState';
import { ChipStrip } from '@/components/ChipStrip';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';


export const VehicleMonitorList = () => {
    // The list scrolls with the panel around it rather than in a box of its own.
    const [scroller, setScroller] = useState<HTMLElement | null>(null);
    const listRef = useCallback((list: HTMLDivElement | null) => {
        setScroller(list?.closest<HTMLElement>('[data-slot="scroll-area-viewport"], [data-panel-scroller]') ?? null);
    }, []);
    const { t } = useTranslation();
    const cityConfig = useCityConfig();
    const allowedVehicleTypes = useMemo(
        () => [...(cityConfig.filters?.vehicles ?? [])].sort((a, b) => routeTypeRank(a) - routeTypeRank(b)),
        [cityConfig.filters?.vehicles],
    );

    const [searchQuery, setSearchQuery] = useState('');
    const [searchField, setSearchField] = useState<VehicleSearchField>('line');
    const [modeFilter, setModeFilter] = useState<string>('all');

    const { networkVehicles: activeCollection, isFetching: isNetworkFetching } = useVehicles();

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
            <SearchField
                value={searchQuery}
                onValueChange={setSearchQuery}
                placeholder={searchField === 'vehicle' ? t('stats.monitor.searchByVehicle') : t('stats.monitor.searchByLine')}
                aria-label={searchField === 'vehicle' ? t('stats.monitor.searchByVehicle') : t('stats.monitor.searchByLine')}
                clearLabel={t('search.clearFilter')}
                lead={
                    <Tabs value={searchField} onValueChange={setSearchField}>
                        <TabsList size="sm">
                            <TabsTrigger value="line">{t('stats.monitor.fieldLine')}</TabsTrigger>
                            <TabsTrigger value="vehicle">{t('stats.monitor.fieldVehicle')}</TabsTrigger>
                        </TabsList>
                    </Tabs>
                }
            />

            <ChipStrip>
                <FilterChip label={t('common.all')} count={totalCount} isActive={modeFilter === 'all'} onClick={() => setModeFilter('all')} />
                {allowedVehicleTypes.map(slug => {
                    const count = modeCounts[slug] ?? 0;
                    const Icon = ROUTE_TYPE_ICONS[slug as keyof typeof ROUTE_TYPE_ICONS];
                    if (count === 0 || !Icon) return null;
                    const isActive = modeFilter === slug;
                    return (
                        <FilterChip
                            key={slug}
                            icon={Icon}
                            label={t(`settings.vehicleTypes.${slug}`)}
                            count={count}
                            isActive={isActive}
                            onClick={() => setModeFilter(isActive ? 'all' : slug)}
                        />
                    );
                })}
            </ChipStrip>

            <div className="flex items-center justify-between type-note text-muted-foreground px-0.5">
                <span>
                    {t('stats.monitor.showingCount', { count: items.length, total: totalCount })}
                </span>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground opacity-60">
                    <Activity className="animate-pulse" size={24} />
                    <span className="type-note">{t('common.loading')}</span>
                </div>
            ) : items.length > 0 ? (
                <div ref={listRef} className="overflow-hidden rounded-surface bg-fill">
                    {scroller && (
                        <Virtuoso
                            customScrollParent={scroller}
                            data={items}
                            itemContent={(_index, item) => <VehicleMonitorRow key={item.id} item={item} />}
                        />
                    )}
                </div>
            ) : (
                <EmptyState icon={Bus} title={t('stats.monitor.noVehiclesFound')} />
            )}
        </div>
    );
};
