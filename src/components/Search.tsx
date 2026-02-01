import React, { useState, useEffect, useRef } from 'react';
import { Search as SearchIcon, X, MapPin } from 'lucide-react';

interface StopFeature {
    type: 'Feature';
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    };
    properties: {
        stop_id: string;
        stop_name: string;
        platform_code?: string;
    };
}

interface SearchProps {
    stops: { features: StopFeature[] } | null;
    onSelect: (stop: StopFeature) => void;
}

export const Search: React.FC<SearchProps> = ({ stops, onSelect }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<StopFeature[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!query.trim() || !stops) {
            setResults([]);
            return;
        }

        const searchTerm = query.toLowerCase();
        const filtered = stops.features
            .filter(stop => stop.properties.stop_name.toLowerCase().includes(searchTerm))
            // Sort by match position (starts with first) and then by name
            .sort((a, b) => {
                const nameA = a.properties.stop_name.toLowerCase();
                const nameB = b.properties.stop_name.toLowerCase();
                const startA = nameA.startsWith(searchTerm) ? 0 : 1;
                const startB = nameB.startsWith(searchTerm) ? 0 : 1;
                return startA - startB || nameA.localeCompare(nameB);
            })
            .slice(0, 8); // Show only top 8 results for performance

        // Deduplicate common stop names (Muzeum A vs Muzeum C etc in search results)
        const seen = new Set();
        const unique = filtered.filter(stop => {
            const key = stop.properties.stop_name;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        setResults(unique);
    }, [query, stops]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (stop: StopFeature) => {
        onSelect(stop);
        setQuery('');
        setIsOpen(false);
    };

    return (
        <div ref={containerRef} className="absolute left-4 top-4 z-20 w-[calc(100%-100px)] md:w-80 group">
            <div
                className={`
                    relative flex items-center gap-3 px-4 h-11
                    bg-black/40 backdrop-blur-md rounded-2xl border border-white/10
                    shadow-2xl transition-all duration-300
                    ${isOpen && results.length > 0 ? 'rounded-b-none border-b-transparent ring-2 ring-white/5' : ''}
                `}
                style={{ top: 'calc(0rem + env(safe-area-inset-top, 0px))' }}
            >
                <SearchIcon size={20} className="text-slate-400 group-focus-within:text-white transition-colors" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder="Search stops..."
                    className="flex-1 bg-transparent border-none outline-none text-white text-sm placeholder:text-slate-500 font-medium"
                />
                {query && (
                    <button
                        onClick={() => setQuery('')}
                        className="p-1 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-all"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            {/* Results Dropdown */}
            {isOpen && results.length > 0 && (
                <div
                    className="absolute top-full left-0 right-0 bg-zinc-900/90 backdrop-blur-3xl border border-white/10 border-t-transparent rounded-b-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.7)] animate-in slide-in-from-top-2 duration-200"
                    style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}
                >
                    <div className="max-h-80 overflow-y-auto custom-scrollbar">
                        {results.map((stop) => (
                            <button
                                key={stop.properties.stop_id}
                                onClick={() => handleSelect(stop)}
                                className="w-full flex items-center gap-3 px-4 py-4 hover:bg-white/5 active:bg-white/10 text-left transition-colors border-b border-white/5 last:border-none group/item"
                            >
                                <div className="p-2.5 bg-white/5 rounded-xl text-slate-400 group-hover/item:text-white group-hover/item:bg-white/10 transition-all">
                                    <MapPin size={18} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-white text-sm font-semibold truncate group-hover/item:translate-x-0.5 transition-transform">{stop.properties.stop_name}</div>
                                    <div className="text-slate-500 text-[9px] uppercase font-bold tracking-[0.15em] mt-1">PID Station</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
