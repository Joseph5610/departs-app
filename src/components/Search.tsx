import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search as SearchIcon, X, MapPin } from 'lucide-react';

interface Stop {
    type: 'Feature';
    properties: {
        stop_id: string;
        stop_name: string;
        platform_code?: string;
    };
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    };
}

interface SearchProps {
    stops: { features: Stop[] } | null;
    onSelect: (stop: Stop) => void;
}

export const Search: React.FC<SearchProps> = ({ stops, onSelect }) => {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const results = useMemo(() => {
        if (!stops?.features || query.length < 2) return [];

        const normalizedQuery = query.toLowerCase();

        // 1. Filter and score matches
        const matches = (stops.features as Stop[])
            .filter(stop => stop.properties.stop_name.toLowerCase().includes(normalizedQuery))
            .map(stop => {
                const name = stop.properties.stop_name.toLowerCase();
                let score = 0;
                if (name.startsWith(normalizedQuery)) score += 100;
                return { stop, score };
            });

        // 2. Sort by score and name
        matches.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.stop.properties.stop_name.localeCompare(b.stop.properties.stop_name);
        });

        // 3. Deduplicate by name (keeping the first occurrence)
        const seen = new Set<string>();
        const uniqueMatches: Stop[] = [];
        for (const match of matches) {
            if (!seen.has(match.stop.properties.stop_name)) {
                seen.add(match.stop.properties.stop_name);
                uniqueMatches.push(match.stop);
            }
            if (uniqueMatches.length >= 10) break;
        }

        return uniqueMatches;
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

    return (
        <div
            ref={containerRef}
            className="absolute top-4 left-4 z-10 w-[calc(100%-2rem)] md:w-80"
            style={{ top: 'calc(1rem + env(safe-area-inset-top, 0px))', left: 'calc(1rem + env(safe-area-inset-left, 0px))' }}
        >
            <div className="relative h-11 flex items-center">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={20} />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder="Search stops..."
                    className="w-full h-full bg-black/90 backdrop-blur-md pl-10 pr-10 text-white text-base placeholder:text-zinc-500 rounded-2xl border border-white/10 shadow-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
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
                                    <span className="text-zinc-500 text-xs">Platform {stop.properties.platform_code}</span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
