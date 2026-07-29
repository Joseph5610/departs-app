import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePreferencesStore } from '../../../state/preferencesStore';
import { useCities } from '../../../hooks/data/useCities';
import { DEFAULT_CITY_SLUG } from '../../../config/cities';
import { apiFetch } from '../../../lib/api-client';
import { RefreshCw, AlertCircle, Bus, Info, Copy, Check, Maximize2, Minimize2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
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
            if (selectedCity === DEFAULT_CITY_SLUG) {
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
        <div className="flex items-center gap-2">
            <Tabs value={selectedCity} onValueChange={(v) => setSelectedCity(v)} className="hidden sm:block">
                <TabsList variant="pill">
                    {citiesData?.cities.map(city => (
                        <TabsTrigger key={city.slug} value={city.slug}>{city.name}</TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            <Tabs value={feedType} onValueChange={(v) => setFeedType(v as 'vehicles' | 'alerts')}>
                <TabsList variant="pill">
                    <TabsTrigger value="vehicles" className="gap-1.5">
                        <Bus size={14} />
                        <span>Vehicles</span>
                    </TabsTrigger>
                    <TabsTrigger value="alerts" className="gap-1.5">
                        <Info size={14} />
                        <span>Alerts</span>
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            <Button 
                onClick={handleRefresh}
                disabled={isLoading || isRefreshing}
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/10 shrink-0 cursor-pointer"
                title="Refresh Feed"
            >
                <RefreshCw size={16} className={isRefreshing || isLoading ? "animate-spin text-primary" : ""} />
            </Button>
        </div>
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
                    <TabsList variant="default" className="grid grid-cols-2 w-full h-9 p-1 rounded-xl bg-muted/50 border border-border/50">
                        <TabsTrigger value="prague" className="h-7 text-xs font-semibold rounded-lg">PRG</TabsTrigger>
                        <TabsTrigger value="brno" className="h-7 text-xs font-semibold rounded-lg">BRQ</TabsTrigger>
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
                    <Alert variant="destructive" className="max-w-md p-6 flex flex-col items-center text-center">
                        <AlertCircle size={40} className="mb-4 opacity-80" />
                        <AlertTitle className="text-lg font-bold mb-2">Upstream Connection Error</AlertTitle>
                        <AlertDescription className="text-sm opacity-90 font-mono wrap-break-word">
                            {error instanceof Error ? error.message : 'Unknown error occurred'}
                        </AlertDescription>
                        <Button variant="outline" onClick={handleRefresh} className="mt-4 border-destructive/40 hover:bg-destructive/10 text-destructive">
                            Try Again
                        </Button>
                    </Alert>
                </div>
            )}

            {!!data && !isLoading && !isError && (
                <div className="bg-card/80 backdrop-blur-md rounded-2xl shadow-xs overflow-hidden flex-1 min-h-0 flex flex-col border border-border/40 relative mt-2 sm:mt-0">
                    <div className="bg-foreground/2 px-4 py-2.5 flex items-center justify-between border-b border-border/40 select-none overflow-x-auto">
                        <div className="text-xs text-muted-foreground/80 font-mono items-center gap-2 whitespace-nowrap hidden md:flex">
                            <span className="font-semibold">{selectedCity === 'brno' ? (feedType === 'alerts' ? 'GTFS-RT Alerts -> JSON' : 'GTFS-RT -> JSON') : (feedType === 'alerts' ? 'PID (GTFS-RT PB + RSS XML)' : 'Golemio (/v2/public/vehiclepositions)')}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-auto">
                            <Badge variant="outline" className="text-[10px] font-mono font-bold uppercase tracking-wider bg-foreground/5 border-border/40 text-muted-foreground px-2.5 py-0.5 hidden sm:inline-flex">
                                {getItemsCount()} {feedType === 'vehicles' ? 'vehicles' : 'alerts'}
                            </Badge>
                            <Button
                                variant="outline" size="sm"
                                onClick={() => setIsExpandedAll(!isExpandedAll)}
                                className="h-7 text-xs font-semibold gap-1.5 bg-foreground/5 hover:bg-foreground/10 border-border/40 text-foreground transition-all cursor-pointer"
                            >
                                {isExpandedAll ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                                <span className="hidden sm:inline">{isExpandedAll ? 'Collapse All' : 'Expand All'}</span>
                            </Button>
                            <Button
                                variant="outline" size="sm"
                                onClick={handleCopy}
                                className="h-7 text-xs font-semibold gap-1.5 bg-foreground/5 hover:bg-foreground/10 border-border/40 text-foreground transition-all cursor-pointer"
                            >
                                {isCopied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
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
