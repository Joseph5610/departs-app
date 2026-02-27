import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search as SearchIcon, MapPin, Star, X } from 'lucide-react';
import { useStopSearch } from '../hooks/useStopSearch';
import { useMap } from '../hooks/useMap';
import { MAP_STOP_SELECT_ZOOM, MAP_FLY_DURATION } from '../config/constants';
import { useStops } from '../hooks/useStops';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
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

    const linesFromQuery = React.useMemo(() => {
        return query.split(',').map(s => s.trim().toUpperCase()).filter(s => s.length > 0 && s.length <= 4);
    }, [query]);

    const isLineLike = React.useMemo(() => {
        const trimmed = query.trim();
        if (trimmed.length === 0) return false;
        if (!trimmed.includes(',')) return trimmed.length <= 4 && !trimmed.includes(' ');
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

    const handleSelectStop = (stop: any) => {
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
    };

    return (
        <div
            ref={containerRef}
            className="absolute z-10 right-16 md:right-auto md:w-80 safe-top safe-left"
        >
            <Command className="rounded-2xl border border-white/10 bg-black/90 backdrop-blur-md shadow-2xl">
                <div className="flex items-center px-3 border-b border-white/5">
                    <SearchIcon className={cn(
                        "mr-2 h-4 w-4 shrink-0 opacity-50",
                        activeFilter && "text-emerald-400 opacity-100"
                    )} />
                    <CommandInput
                        placeholder={t('search.placeholder')}
                        value={activeFilter ? t('search.lineFilter', { line: activeFilter.join(', ') }) : query}
                        onValueChange={(v) => {
                            if (activeFilter) {
                                onLineSelect(null);
                                setQuery('');
                            } else {
                                setQuery(v);
                            }
                            setIsOpen(true);
                        }}
                        onFocus={() => setIsOpen(true)}
                        className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    {(query || activeFilter) && (
                        <button
                            onClick={() => {
                                if (activeFilter) onLineSelect(null);
                                setQuery('');
                            }}
                            className="ml-2 h-8 w-8 flex items-center justify-center rounded-full hover:bg-white/10 text-zinc-500 hover:text-white transition-colors"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                {isOpen && (
                    <CommandList className="max-h-[60vh]">
                        <CommandEmpty>{t('search.noResults')}</CommandEmpty>

                        {isLineLike && (
                            <CommandGroup heading={t('search.actions')}>
                                <CommandItem
                                    onSelect={() => {
                                        onLineSelect(linesFromQuery);
                                        setQuery('');
                                        setIsOpen(false);
                                    }}
                                    className="cursor-pointer gap-3 py-3"
                                >
                                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                                        <SearchIcon size={16} />
                                    </div>
                                    <span className="font-medium">{t('search.lineFilter', { line: linesFromQuery.join(', ') })}</span>
                                </CommandItem>
                            </CommandGroup>
                        )}

                        {query === '' && favoriteStopFeatures.length > 0 && (
                            <CommandGroup heading={t('search.favorites')}>
                                {favoriteStopFeatures.map(stop => (
                                    <CommandItem
                                        key={stop.properties.stop_id}
                                        onSelect={() => handleSelectStop(stop)}
                                        className="cursor-pointer gap-3 py-3"
                                    >
                                        <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                                            <Star size={16} fill="currentColor" />
                                        </div>
                                        <div className="flex flex-col flex-1 overflow-hidden">
                                            <span className="font-medium truncate">{stop.properties.stop_name}</span>
                                            {stop.properties.platform_code && (
                                                <span className="text-zinc-500 text-xs">{t('search.platform', { code: stop.properties.platform_code })}</span>
                                            )}
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}

                        {searchResults.length > 0 && (
                            <CommandGroup heading={t('search.stops')}>
                                {searchResults.map(stop => (
                                    <CommandItem
                                        key={stop.properties.stop_id}
                                        onSelect={() => handleSelectStop(stop)}
                                        className="cursor-pointer gap-3 py-3"
                                    >
                                        <div className={cn(
                                            "p-2 rounded-lg text-zinc-400",
                                            favoriteStops.includes(stop.properties.stop_id) ? "bg-amber-500/10 text-amber-400" : "bg-white/5"
                                        )}>
                                            {favoriteStops.includes(stop.properties.stop_id) ? <Star size={16} fill="currentColor" /> : <MapPin size={16} />}
                                        </div>
                                        <div className="flex flex-col flex-1 overflow-hidden">
                                            <span className="font-medium truncate">{stop.properties.stop_name}</span>
                                            {stop.properties.platform_code && (
                                                <span className="text-zinc-500 text-xs">{t('search.platform', { code: stop.properties.platform_code })}</span>
                                            )}
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                    </CommandList>
                )}
            </Command>
        </div>
    );
});

Search.displayName = 'Search';
