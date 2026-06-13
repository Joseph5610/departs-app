import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useCities } from '../../hooks/data/useCities';
import { apiFetch } from '../../lib/api-client';
import { Link } from 'wouter';
import { ArrowLeft, RefreshCw, AlertCircle, Bus, Info, Copy, Check, Maximize2, Minimize2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { JsonView, darkStyles } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';
import { toast } from 'sonner';

export const FeedExplorer: React.FC = () => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const { setSelectedCity } = usePreferencesStore(s => s.actions);
    const { data: citiesData } = useCities();
    const [feedType, setFeedType] = useState<'vehicles' | 'alerts'>('vehicles');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isExpandedAll, setIsExpandedAll] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ['debug-feed', selectedCity, feedType],
        queryFn: () => apiFetch<unknown>(`/${selectedCity}/debug-feed?type=${feedType}`),
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
                const prgData = data as { incidents?: { rss?: { channel?: { item?: unknown } } }, exclusions?: { rss?: { channel?: { item?: unknown } } } };
                const inc = prgData.incidents?.rss?.channel?.item;
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

    return (
        <div className="flex flex-col h-dvh bg-background text-foreground overflow-hidden">
            {/* Header Area */}
            <div className="flex-none border-b border-border bg-card p-3 shadow-sm z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center justify-between w-full sm:w-auto">
                    <div className="flex items-center gap-2">
                        <Link href="/">
                            <button className="p-2 hover:bg-muted rounded-full transition-colors" aria-label="Go back">
                                <ArrowLeft size={20} />
                            </button>
                        </Link>
                        <h1 className="text-xl font-bold font-mono tracking-tight flex items-center gap-2">
                            <span>Raw Feed</span>
                            <span className="bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded-sm uppercase tracking-wider">Debug</span>
                        </h1>
                    </div>
                    
                    {/* Mobile Controls right side */}
                    <div className="flex items-center gap-2 sm:hidden">
                        <Tabs value={selectedCity} onValueChange={(v) => setSelectedCity(v)}>
                            <TabsList variant="pill" className="grid grid-cols-2">
                                <TabsTrigger value="prague">PRG</TabsTrigger>
                                <TabsTrigger value="brno">BRQ</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4">
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
                        <button 
                            onClick={handleRefresh}
                            disabled={isLoading || isRefreshing}
                            className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm font-medium"
                            title="Refresh Data"
                        >
                            <RefreshCw size={16} className={isRefreshing || isLoading ? "animate-spin" : ""} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-2 sm:p-4 bg-muted/30">
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
                    <div className="bg-[#1e1e1e] rounded-xl shadow-xl overflow-hidden h-full flex flex-col border border-white/10 relative">
                        {/* Fake Mac OS window header */}
                        <div className="bg-[#2d2d2d] px-4 py-2 flex items-center justify-between border-b border-white/5 select-none overflow-x-auto">
                            <div className="flex gap-2 items-center shrink-0 mr-4">
                                <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                                <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
                            </div>
                            <div className="text-xs text-white/50 font-mono items-center gap-2 whitespace-nowrap hidden md:flex">
                                <span>{citiesData?.cities.find(c => c.slug === selectedCity)?.adapter === 'gtfs' ? (feedType === 'alerts' ? 'GTFS-RT Alerts -> JSON' : 'GTFS-RT -> JSON') : (feedType === 'alerts' ? 'PID (RSS XML -> JSON)' : 'Golemio (/v2/public/vehiclepositions)')}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-auto">
                                <div className="text-xs text-white/40 font-mono bg-white/5 px-2 py-1 rounded-md hidden sm:block">
                                    {getItemsCount()} {feedType === 'vehicles' ? 'vehicles' : 'alerts'}
                                </div>
                                <button
                                    onClick={() => setIsExpandedAll(!isExpandedAll)}
                                    className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-md transition-colors"
                                >
                                    {isExpandedAll ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                                    <span className="hidden sm:inline">{isExpandedAll ? 'Collapse All' : 'Expand All'}</span>
                                </button>
                                <button
                                    onClick={handleCopy}
                                    className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-md transition-colors"
                                >
                                    {isCopied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                                    <span className="hidden sm:inline">{isCopied ? 'Copied' : 'Copy JSON'}</span>
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-4 text-xs sm:text-sm font-mono whitespace-pre text-[#d4d4d4] [&>div]:bg-transparent!">
                            <JsonView 
                                key={isExpandedAll ? 'expanded' : 'collapsed'}
                                data={data as Record<string, unknown>} 
                                shouldExpandNode={(level) => isExpandedAll ? true : level < 4} 
                                style={{
                                    ...darkStyles,
                                    container: '', // override default bg
                                }} 
                            />
                        </div>
                        {/* Floating refresh button for mobile */}
                        <button 
                            onClick={handleRefresh}
                            disabled={isLoading || isRefreshing}
                            className="absolute bottom-6 right-6 sm:hidden bg-primary text-primary-foreground p-3 rounded-full shadow-lg z-20 hover:scale-105 active:scale-95 transition-transform"
                        >
                            <RefreshCw size={20} className={isRefreshing || isLoading ? "animate-spin" : ""} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
