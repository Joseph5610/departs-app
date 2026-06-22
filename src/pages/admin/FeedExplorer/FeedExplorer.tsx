import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePreferencesStore } from '../../../state/preferencesStore';
import { useCities } from '../../../hooks/data/useCities';
import { apiFetch } from '../../../lib/api-client';
import { RefreshCw, AlertCircle, Bus, Info, Copy, Check, Maximize2, Minimize2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { JsonView, darkStyles, defaultStyles } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';
import { toast } from 'sonner';
import { AdminLayout } from '../AdminLayout';

export const FeedExplorer: React.FC = () => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const { setSelectedCity } = usePreferencesStore(s => s.actions);
    const { data: citiesData } = useCities();
    const [feedType, setFeedType] = useState<'vehicles' | 'alerts'>('vehicles');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isExpandedAll, setIsExpandedAll] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const isDark = document.documentElement.classList.contains('dark');

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ['debug-feed', selectedCity, feedType],
        queryFn: () => apiFetch<unknown>(`/admin/${selectedCity}/debug-feed?type=${feedType}`),
        enabled: !!selectedCity,
        refetchOnWindowFocus: false,
    });

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await refetch();
        setIsRefreshing(false);
    };

    const handleCopy = async () => {
        if (!data) return;
        try {
            await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
            setIsCopied(true);
            toast.success("JSON copied to clipboard");
            setTimeout(() => setIsCopied(false), 2000);
        } catch {
            toast.error("Failed to copy");
        }
    };

    const getItemsCount = () => {
        if (!data) return 0;
        if (feedType === 'alerts') {
            if (selectedCity === 'prague') {
                const prgData = data as { incidents?: { entity?: unknown[], rss?: { channel?: { item?: unknown } } }, exclusions?: { rss?: { channel?: { item?: unknown } } } };
                const inc = prgData.incidents?.entity || prgData.incidents?.rss?.channel?.item;
                const exc = prgData.exclusions?.rss?.channel?.item;
                let count = 0;
                if (Array.isArray(inc)) count += inc.length;
                else if (inc) count += 1;
                if (Array.isArray(exc)) count += exc.length;
                else if (exc) count += 1;
                return count;
            }
            return Array.isArray(data) ? data.length : 0; // gtfs array
        }
        const vehData = data as { entity?: unknown[], features?: unknown[] };
        return vehData.entity ? vehData.entity.length : vehData.features ? vehData.features.length : 0;
    };

    const headerActions = (
        <>
            <Tabs value={selectedCity} onValueChange={(v) => setSelectedCity(v)} className="hidden sm:block w-full sm:w-auto">
                <TabsList variant="pill" className="w-full sm:w-auto grid grid-cols-2">
                    {citiesData?.cities.map(city => (
                        <TabsTrigger key={city.slug} value={city.slug}>{city.name}</TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            <Tabs value={feedType} onValueChange={(v) => setFeedType(v as 'vehicles' | 'alerts')} className="w-full sm:w-auto">
                <TabsList variant="pill" className="w-full sm:w-auto grid grid-cols-2">
                    <TabsTrigger value="vehicles" className="flex gap-2">
                        <Bus size={14} /> Vehicles
                    </TabsTrigger>
                    <TabsTrigger value="alerts" className="flex gap-2">
                        <Info size={14} /> Alerts
                    </TabsTrigger>
                </TabsList>
            </Tabs>
            
            <div className="hidden sm:flex items-center gap-2">
                <Button 
                    onClick={handleRefresh}
                    disabled={isLoading || isRefreshing}
                    variant="outline"
                    size="sm"
                    title="Refresh Data"
                >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing || isLoading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>
        </>
    );

    const titleNode = (
        <span className="flex items-center gap-2">
            <span>Feed Explorer</span>
        </span>
    );

    return (
        <AdminLayout title={titleNode} headerActions={headerActions} contentClassName="p-2 sm:p-4 flex flex-col min-h-0 h-full">
            <div className="flex items-center gap-2 sm:hidden shrink-0">
                <Tabs value={selectedCity} onValueChange={(v) => setSelectedCity(v)} className="w-full">
                    <TabsList variant="pill" className="grid grid-cols-2 w-full">
                        <TabsTrigger value="prague">PRG</TabsTrigger>
                        <TabsTrigger value="brno">BRQ</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {isLoading && (
                <div className="flex h-full items-center justify-center text-muted-foreground flex-col gap-3">
                    <RefreshCw size={32} className="animate-spin opacity-50" />
                    <p className="font-mono text-sm">Loading upstream {feedType}...</p>
                </div>
            )}

            {isError && (
                <div className="flex h-full items-center justify-center p-4">
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive p-6 rounded-xl max-w-md text-center shadow-sm">
                        <AlertCircle size={40} className="mx-auto mb-4 opacity-80" />
                        <h2 className="text-lg font-bold mb-2">Upstream Connection Error</h2>
                        <p className="text-sm opacity-90 font-mono wrap-break-word">{error instanceof Error ? error.message : 'Unknown error occurred'}</p>
                        <button onClick={handleRefresh} className="mt-4 px-4 py-2 bg-destructive/20 hover:bg-destructive/30 rounded-md font-medium text-sm transition-colors">Try Again</button>
                    </div>
                </div>
            )}

            {!!data && !isLoading && !isError && (
                <div className="bg-card rounded-xl shadow-sm overflow-hidden flex-1 min-h-0 flex flex-col border border-border relative mt-2 sm:mt-0">
                    <div className="bg-muted/30 px-4 py-2 flex items-center justify-between border-b border-border select-none overflow-x-auto">
                        <div className="text-xs text-muted-foreground font-mono items-center gap-2 whitespace-nowrap hidden md:flex">
                            <span>{citiesData?.cities.find(c => c.slug === selectedCity)?.adapter === 'gtfs' ? (feedType === 'alerts' ? 'GTFS-RT Alerts -> JSON' : 'GTFS-RT -> JSON') : (feedType === 'alerts' ? 'PID (GTFS-RT PB + RSS XML)' : 'Golemio (/v2/public/vehiclepositions)')}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-auto">
                            <div className="text-xs text-muted-foreground font-mono bg-muted/50 border border-border px-2 py-1 rounded-md hidden sm:block">
                                {getItemsCount()} {feedType === 'vehicles' ? 'vehicles' : 'alerts'}
                            </div>
                            <Button
                                variant="ghost" size="sm"
                                onClick={() => setIsExpandedAll(!isExpandedAll)}
                                className="h-7 text-xs flex items-center gap-1.5"
                            >
                                {isExpandedAll ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                                <span className="hidden sm:inline">{isExpandedAll ? 'Collapse All' : 'Expand All'}</span>
                            </Button>
                            <Button
                                variant="ghost" size="sm"
                                onClick={handleCopy}
                                className="h-7 text-xs flex items-center gap-1.5"
                            >
                                {isCopied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                <span className="hidden sm:inline">{isCopied ? 'Copied' : 'Copy JSON'}</span>
                            </Button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto p-4 text-xs sm:text-sm font-mono whitespace-pre text-foreground [&>div]:bg-transparent!">
                        <JsonView 
                            key={isExpandedAll ? 'expanded' : 'collapsed'}
                            data={data as Record<string, unknown>} 
                            shouldExpandNode={(level) => isExpandedAll ? true : level < 4} 
                            style={{
                                ...(isDark ? darkStyles : defaultStyles),
                                container: '', // override default bg
                            }} 
                        />
                    </div>
                    {/* Floating refresh button for mobile */}
                    <Button 
                        onClick={handleRefresh}
                        disabled={isLoading || isRefreshing}
                        className="absolute bottom-6 right-6 sm:hidden h-12 w-12 rounded-full shadow-lg z-20 hover:scale-105 active:scale-95 transition-transform p-0"
                    >
                        <RefreshCw size={20} className={isRefreshing || isLoading ? "animate-spin" : ""} />
                    </Button>
                </div>
            )}
        </AdminLayout>
    );
};
