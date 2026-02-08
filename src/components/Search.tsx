
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search as SearchIcon, X, MapPin } from 'lucide-react';
import { useStopSearch, type Stop } from '../hooks/useStopSearch';

interface SearchProps {
    stops: { features: Stop[] } | null;
    onSelect: (stop: Stop) => void;
}

export const Search: React.FC<SearchProps> = ({ stops, onSelect }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = React.useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const { query, setQuery, results } = useStopSearch(stops);

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
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder={t('search.placeholder')}
                    className="w-full h-full bg-black/90 backdrop-blur-md pl-10 pr-10 text-white text-base placeholder:text-zinc-500 rounded-2xl border border-white/10 shadow-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none z-10" size={20} />
                {query && (
                    <button
                        onClick={() => {
                            setQuery('');
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            {isOpen && results.length > 0 && (
                <div className="mt-2 bg-black/90 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden max-h-[60vh] overflow-y-auto">
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
};
