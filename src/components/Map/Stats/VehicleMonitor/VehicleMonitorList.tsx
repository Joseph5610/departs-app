import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Search, X, Activity } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import { useVehicles } from '@/hooks/data/useVehicles';
import { useVehicleMonitor } from '@/hooks/derived/useVehicleMonitor';
import type { SearchField } from '@/domain/vehicles';
import { VehicleMonitorRow } from './VehicleMonitorRow';
import { FilterChip } from '@/components/FilterChip';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { useCityConfig } from '@/hooks/data/useCities';
import { routeTypeRank } from '@/domain/routes';
import { ROUTE_TYPE_ICONS } from '@/components/routeTypeIcons';


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
    const [searchField, setSearchField] = useState<SearchField>('line');
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
            <div className="flex h-control-lg items-center gap-2 rounded-full bg-field pr-1 pl-3">
                <Search size={16} strokeWidth={1.75} className="text-muted-foreground shrink-0" />

                <SegmentedControl
                    size="sm"
                    value={searchField}
                    onChange={setSearchField}
                    options={[
                        { value: 'line', label: t('stats.monitor.fieldLine') },
                        { value: 'vehicle', label: t('stats.monitor.fieldVehicle') },
                    ]}
                />

                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                        searchField === 'vehicle' ? t('stats.monitor.searchByVehicle')
                        : t('stats.monitor.searchByLine')
                    }
                    className="flex-1 min-w-0 bg-transparent type-row outline-none ring-0 border-0 focus:outline-none focus:ring-0 placeholder:text-muted-foreground"
                />

                {searchQuery && (
                    <Button variant="ghost" size="icon-2xs" className="mr-1 shrink-0" onClick={() => setSearchQuery('')} aria-label={t('search.clearFilter')}>
                        <X size={14} strokeWidth={2} />
                    </Button>
                )}
            </div>

            <div className="-my-2 flex items-center gap-1.5 overflow-x-auto py-2.5 no-scrollbar">
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
            </div>

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
                <Empty className="py-10">
                    <EmptyHeader>
                        <EmptyTitle className="type-note text-muted-foreground">
                            {t('stats.monitor.noVehiclesFound')}
                        </EmptyTitle>
                    </EmptyHeader>
                </Empty>
            )}
        </div>
    );
};
