
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search as SearchIcon, X, MapPin, Star } from 'lucide-react';
import { useStopSearch } from '../hooks/useStopSearch';
import { useMap } from '../hooks/useMap';
import { MAP_STOP_SELECT_ZOOM, MAP_FLY_DURATION } from '../config/constants';
import { useStops } from '../hooks/useStops';



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
        return query.split(',').map(s => s.trim().toUpperCase()).filter(s => s.length > 0 && s.length <= 10);
    }, [query]);

    const isLineLike = React.useMemo(() => {
        const trimmed = query.trim();
        if (trimmed.length === 0) return false;

        if (!trimmed.includes(',')) {
            return trimmed.length <= 10 && !trimmed.includes(' ');
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
            <div className="relative h-11 flex items-center">
                <input
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
                    className={`w-full h-full bg-black/90 backdrop-blur-md pl-10 pr-10 text-white text-base placeholder:text-zinc-500 rounded-2xl border ${activeFilter ? 'border-emerald-500/50 ring-2 ring-emerald-500/10' : 'border-white/10'} shadow-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all`}
                    readOnly={!!activeFilter}
                />
                <SearchIcon className={`absolute left-3 top-1/2 -translate-y-1/2 ${activeFilter ? 'text-emerald-400' : 'text-zinc-400'} pointer-events-none z-10`} size={20} />
                {(query || activeFilter) && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (activeFilter) {
                                onLineSelect(null);
                            }
                            setQuery('');
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white active:scale-90 transition-all z-20"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            {isOpen && (results.length > 0 || isLineLike) && (
                <div className="mt-2 bg-black/90 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden max-h-[60vh] overflow-y-auto">
                    {query === '' && results.length > 0 && (
                        <div className="px-4 py-2 bg-white/5 border-b border-white/5">
                            <span className="text-zinc-500 text-[10px] uppercase font-black tracking-widest flex items-center gap-2">
                                <Star size={10} fill="currentColor" />
                                {t('search.favorites')}
                            </span>
                        </div>
                    )}
                    {isLineLike && (
                        <button
                            onClick={() => {
                                onLineSelect(linesFromQuery);
                                setQuery('');
                                setIsOpen(false);
                            }}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-emerald-500/10 active:bg-emerald-500/20 transition-colors text-left border-b border-white/5"
                        >
                            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                                <SearchIcon size={16} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-white font-medium">{t('search.lineFilter', { line: linesFromQuery.join(', ') })}</span>
                            </div>
                        </button>
                    )}
                    {results.map((stop) => (
                        <button
                            key={stop.properties.stop_id}
                            onClick={() => {
                                // Handle selection logic internally
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
                                    isTrain: stop.properties.is_train === 1,
                                    coordinates: stop.geometry.coordinates as [number, number]
                                });
                                setQuery('');
                                setIsOpen(false);
                            }}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 active:bg-white/10 transition-colors text-left border-b border-white/5 last:border-none"
                        >
                            <div className={`p-2 rounded-lg ${favoriteStops.includes(stop.properties.stop_id) ? 'bg-amber-500/10 text-amber-400' : 'bg-white/5 text-zinc-400'}`}>
                                {favoriteStops.includes(stop.properties.stop_id) ? <Star size={16} fill="currentColor" /> : <MapPin size={16} />}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-white font-medium">{stop.properties.stop_name}</span>
                                {stop.properties.platform_code && (
                                    <span className="text-zinc-500 text-xs">{t('search.platform', { code: stop.properties.platform_code })}</span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
});

Search.displayName = 'Search';
