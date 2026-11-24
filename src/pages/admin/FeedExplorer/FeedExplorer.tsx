import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Maximize2, Minimize2 } from 'lucide-react';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useCityConfig } from '@/hooks/data/useCities';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { CITY_LIST, DEFAULT_CITY_SLUG } from '@/config/cities';
import type { AppError } from '@/types';
import { apiFetch } from '@/lib/apiClient';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/CopyButton';
import { AdminLayout } from '@/pages/admin/AdminLayout';
import { AdminStatus, JsonPanel, RefreshButton } from '@/pages/admin/AdminParts';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type FeedType = 'vehicles' | 'alerts';
type RssItems = { rss?: { channel?: { item?: unknown } } };

const countOf = (items: unknown): number => Array.isArray(items) ? items.length : items ? 1 : 0;

/** How many vehicles or alerts a raw upstream feed carries, whatever its shape. */
const feedItemCount = (data: unknown, feedType: FeedType, isPrague: boolean): number => {
    if (!data) return 0;
    if (Array.isArray(data)) return data.length;
    if (feedType === 'alerts') {
        if (!isPrague) return 0;
        const { incidents, exclusions } = data as { incidents?: RssItems & { entity?: unknown[] }; exclusions?: RssItems };
        return countOf(incidents?.entity ?? incidents?.rss?.channel?.item) + countOf(exclusions?.rss?.channel?.item);
    }
    const { entity, features } = data as { entity?: unknown[]; features?: unknown[] };
    return (entity ?? features ?? []).length;
};


export const FeedExplorer = () => {
    // Local, so browsing feeds here doesn't switch the city the map opens with.
    const [selectedCity, setSelectedCity] = useState(() => usePreferencesStore.getState().selectedCity);
    const { debugFeedLabels } = useCityConfig(selectedCity);
    const [feedType, setFeedType] = useState<FeedType>('vehicles');
    const [isExpandedAll, setIsExpandedAll] = useState(false);
    const { copiedKey, copy } = useCopyToClipboard();

    const { data, isLoading, isFetching, error, refetch } = useQuery<unknown, AppError>({
        queryKey: ['debug-feed', selectedCity, feedType],
        queryFn: () => apiFetch<unknown>(`/admin/${selectedCity}/debug-feed?type=${feedType}`),
        refetchOnWindowFocus: false,
    });

    return (
        <AdminLayout title="Feed Explorer" headerActions={<RefreshButton onRefresh={() => refetch()} isRefreshing={isFetching} />}>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
                <div className="max-w-full overflow-x-auto no-scrollbar">
                    <Tabs value={selectedCity} onValueChange={setSelectedCity}>
                        <TabsList size="sm">{CITY_LIST.map(city => <TabsTrigger key={city.slug} value={city.slug}>{city.name}</TabsTrigger>)}</TabsList>
                    </Tabs>
                </div>
                <Tabs value={feedType} onValueChange={setFeedType}>
                    <TabsList size="sm">
                        <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
                        <TabsTrigger value="alerts">Alerts</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {isLoading || error ? <AdminStatus error={error} onRetry={() => refetch()} /> : !!data && (
                <Card size="none" className="min-h-0 flex-1 overflow-hidden">
                    <div className="flex shrink-0 items-center gap-2 border-b border-sep px-4 py-2.5">
                        <span className="min-w-0 truncate type-meta text-muted-foreground">{debugFeedLabels[feedType]}</span>
                        <Badge variant="count" className="ml-auto">{feedItemCount(data, feedType, selectedCity === DEFAULT_CITY_SLUG)} {feedType}</Badge>
                        <Button variant="secondary" size="sm" className="gap-1.5 pl-2.5" onClick={() => setIsExpandedAll(!isExpandedAll)}>
                            {isExpandedAll ? <Minimize2 className="size-3.75" /> : <Maximize2 className="size-3.75" />}
                            {isExpandedAll ? 'Collapse' : 'Expand'}
                        </Button>
                        <CopyButton label="Copy JSON" copiedLabel="Copied" isCopied={copiedKey === 'feed'} onCopy={() => copy(JSON.stringify(data, null, 2), 'feed')} />
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto p-4">
                        <JsonPanel key={String(isExpandedAll)} data={data as object} shouldExpandNode={level => isExpandedAll || level < 4} />
                    </div>
                </Card>
            )}
        </AdminLayout>
    );
};
