
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search as SearchIcon, X, MapPin } from 'lucide-react';
import { useStopSearch } from '../hooks/useStopSearch';
import type { StopFeature, StopCollection } from '../types/transit';

interface SearchProps {
    stops: StopCollection | null;
    onSelect: (stop: StopFeature) => void;
    onLineSelect: (line: string[] | null) => void;
    activeFilter: string[] | null;
}

export const Search: React.FC<SearchProps> = React.memo(({ stops, onSelect, onLineSelect, activeFilter }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = React.useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const { query, setQuery, results } = useStopSearch(stops);

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
            className="absolute top-4 left-4 z-10 right-16 md:right-auto md:w-80"
            style={{
                top: 'calc(1rem + env(safe-area-inset-top, 0px))',
                left: 'calc(1rem + env(safe-area-inset-left, 0px))'
            }}
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
                        onClick={() => {
                            if (activeFilter) {
                                onLineSelect(null);
                            }
                            setQuery('');
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            {isOpen && (results.length > 0 || isLineLike) && (
                <div className="mt-2 bg-black/90 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden max-h-[60vh] overflow-y-auto">
                    {isLineLike && (
                        <button
                            onClick={() => {
                                onLineSelect(linesFromQuery);
                                setQuery('');
                                setIsOpen(false);
                            }}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-emerald-500/10 transition-colors text-left border-b border-white/5"
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
                                onSelect(stop);
                                setQuery('');
                                setIsOpen(false);
                            }}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-none"
                        >
                            <div className="p-2 bg-white/5 rounded-lg text-zinc-400">
                                <MapPin size={16} />
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
