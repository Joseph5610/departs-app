import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search as SearchIcon, X, MapPin, Star } from 'lucide-react';
import { useStopSearch } from '../hooks/useStopSearch';
import { useMap } from '../hooks/useMap';
import { MAP_STOP_SELECT_ZOOM, MAP_FLY_DURATION } from '../config/constants';
import { useStops } from '../hooks/useStops';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export const Search: React.FC = React.memo(() => {
    const { t } = useTranslation();
    const { state, actions, mapRef } = useMap();
    const { data: stops } = useStops();

    const { routeFilter: activeFilter, favoriteStops } = state;
    const { setRouteFilter: onLineSelect, selectStop } = actions;
    const [isOpen, setIsOpen] = React.useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const { query, setQuery, results: searchResults } = useStopSearch(stops || null);

    const favoriteStopFeatures = React.useMemo(() => {
        if (!stops?.features || favoriteStops.length === 0) return [];
        return stops.features.filter(s => favoriteStops.includes(s.properties.stop_id));
    }, [stops, favoriteStops]);

    const results = query === '' && !activeFilter ? favoriteStopFeatures : searchResults;

    const linesFromQuery = React.useMemo(() => {
        return query.split(',').map(s => s.trim().toUpperCase()).filter(s => s.length > 0 && s.length <= 4);
    }, [query]);

    const isLineLike = React.useMemo(() => {
        const trimmed = query.trim();
        if (trimmed.length === 0) return false;

        if (!trimmed.includes(',')) {
            return trimmed.length <= 4 && !trimmed.includes(' ');
        }

        return linesFromQuery.length > 0;
    }, [query, linesFromQuery]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div
            ref={containerRef}
            className="absolute z-10 right-16 md:right-auto md:w-80 safe-top safe-left"
        >
            <div className="relative flex items-center h-11">
                <Input
                    type="text"
                    value={activeFilter ? t('search.lineFilter', { line: activeFilter.join(', ') }) : query}
                    onChange={(e) => {
                        if (activeFilter) {
                            onLineSelect(null);
                            setQuery('');
                        } else {
                            setQuery(e.target.value);
                        }
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder={t('search.placeholder')}
                    className={cn(
                        "w-full h-11 bg-black/90 backdrop-blur-md pl-10 pr-10 text-white text-base placeholder:text-zinc-500 rounded-2xl border transition-all shadow-2xl focus-visible:ring-emerald-500/20",
                        activeFilter ? 'border-emerald-500/50 ring-2 ring-emerald-500/10' : 'border-white/10'
                    )}
                    readOnly={!!activeFilter}
                />
                <SearchIcon className={cn(
                    "absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10",
                    activeFilter ? 'text-emerald-400' : 'text-zinc-400'
                )} size={20} />
                {(query || activeFilter) && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            if (activeFilter) {
                                onLineSelect(null);
                            }
                            setQuery('');
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white h-8 w-8 rounded-full"
                    >
                        <X size={18} />
                    </Button>
                )}
            </div>

            {isOpen && (results.length > 0 || isLineLike) && (
                <div className="mt-2 bg-black/90 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[60vh]">
                    <ScrollArea className="flex-1">
                        {query === '' && results.length > 0 && (
                            <div className="px-4 py-2 bg-white/5 border-b border-white/5">
                                <span className="text-zinc-500 text-[10px] uppercase font-black tracking-widest flex items-center gap-2">
                                    <Star size={10} fill="currentColor" />
                                    {t('search.favorites')}
                                </span>
                            </div>
                        )}
                        {isLineLike && (
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    onLineSelect(linesFromQuery);
                                    setQuery('');
                                    setIsOpen(false);
                                }}
                                className="w-full h-auto px-4 py-3 flex items-center justify-start gap-3 hover:bg-emerald-500/10 active:bg-emerald-500/20 transition-colors text-left border-b border-white/5 rounded-none"
                            >
                                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 shrink-0">
                                    <SearchIcon size={16} />
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-white font-medium truncate">{t('search.lineFilter', { line: linesFromQuery.join(', ') })}</span>
                                </div>
                            </Button>
                        )}
                        {results.map((stop) => (
                            <Button
                                key={stop.properties.stop_id}
                                variant="ghost"
                                onClick={() => {
                                    const [lng, lat] = stop.geometry.coordinates;
                                    mapRef.current?.flyTo({
                                        center: [lng, lat],
                                        zoom: MAP_STOP_SELECT_ZOOM,
                                        duration: MAP_FLY_DURATION
                                    });
                                    selectStop({
                                        id: stop.properties.stop_id,
                                        name: stop.properties.stop_name,
                                        platformCode: stop.properties.platform_code,
                                        coordinates: stop.geometry.coordinates as [number, number]
                                    });
                                    setQuery('');
                                    setIsOpen(false);
                                }}
                                className="w-full h-auto px-4 py-3 flex items-center justify-start gap-3 hover:bg-white/5 active:bg-white/10 transition-colors text-left border-b border-white/5 last:border-none rounded-none"
                            >
                                <div className={cn(
                                    "p-2 rounded-lg shrink-0",
                                    favoriteStops.includes(stop.properties.stop_id) ? 'bg-amber-500/10 text-amber-400' : 'bg-white/5 text-zinc-400'
                                )}>
                                    {favoriteStops.includes(stop.properties.stop_id) ? <Star size={16} fill="currentColor" /> : <MapPin size={16} />}
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-white font-medium truncate">{stop.properties.stop_name}</span>
                                    {stop.properties.platform_code && (
                                        <span className="text-zinc-500 text-xs">{t('search.platform', { code: stop.properties.platform_code })}</span>
                                    )}
                                </div>
                            </Button>
                        ))}
                    </ScrollArea>
                </div>
            )}
        </div>
    );
});

Search.displayName = 'Search';
