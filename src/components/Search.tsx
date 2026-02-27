import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search as SearchIcon, X, MapPin, Star } from 'lucide-react';
import { useStopSearch } from '../hooks/useStopSearch';
import { useMap } from '../hooks/useMap';
import { MAP_STOP_SELECT_ZOOM, MAP_FLY_DURATION } from '../config/constants';
import { useStops } from '../hooks/useStops';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

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

    const handleStopSelect = (stop: any) => {
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
            <Command className="rounded-2xl border-none bg-transparent overflow-visible">
                <div className="relative flex items-center h-11">
                    <CommandInput
                        value={activeFilter ? t('search.lineFilter', { line: activeFilter.join(', ') }) : query}
                        onValueChange={(v: string) => {
                            if (activeFilter) {
                                onLineSelect(null);
                                setQuery('');
                            } else {
                                setQuery(v);
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
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white h-8 w-8 rounded-full z-20"
                        >
                            <X size={18} />
                        </Button>
                    )}
                </div>

                {isOpen && (results.length > 0 || isLineLike) && (
                    <CommandList className="mt-2 bg-black/90 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden max-h-[60vh]">
                        <CommandEmpty>{t('search.noResults')}</CommandEmpty>

                        {isLineLike && (
                            <CommandGroup>
                                <CommandItem
                                    onSelect={() => {
                                        onLineSelect(linesFromQuery);
                                        setQuery('');
                                        setIsOpen(false);
                                    }}
                                    className="px-4 py-3 flex items-center justify-start gap-3 aria-selected:bg-emerald-500/10 transition-colors cursor-pointer"
                                >
                                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 shrink-0">
                                        <SearchIcon size={16} />
                                    </div>
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="text-white font-medium truncate">{t('search.lineFilter', { line: linesFromQuery.join(', ') })}</span>
                                    </div>
                                </CommandItem>
                            </CommandGroup>
                        )}

                        <CommandGroup heading={query === '' && results.length > 0 ? t('search.favorites') : undefined}>
                            {results.map((stop) => (
                                <CommandItem
                                    key={stop.properties.stop_id}
                                    onSelect={() => handleStopSelect(stop)}
                                    className="px-4 py-3 flex items-center justify-start gap-3 aria-selected:bg-white/5 transition-colors cursor-pointer"
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
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                )}
            </Command>
        </div>
    );
});

Search.displayName = 'Search';
