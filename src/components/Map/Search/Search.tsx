import { useEffect, useRef, useState, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search as SearchIcon, X } from 'lucide-react';
import { useSearch } from '@/hooks/features/useSearch';
import { useRouteParams } from '@/hooks/useRouteParams';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Autocomplete } from '@base-ui/react/autocomplete';
import { SearchDropdown } from './SearchDropdown';
import { CitySwitcher } from '@/components/Map/CitySwitcher';

/**
 * The desktop search box floating over the map, with its dropdown of results.
 * Manages keyboard shortcuts and click-outside; phones use MobileSearch in the sheet instead.
 */
export const Search = memo(() => {
    const { t } = useTranslation();
    const { stopId: selectedStopId, vehicleId: selectedVehicleId, isStatsRoute, isFavoritesRoute } = useRouteParams();

    const isSidebarOpen = !!selectedStopId || !!selectedVehicleId || isStatsRoute || isFavoritesRoute;
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const s = useSearch(isOpen, () => setIsOpen(false));
    const { query, setQuery, activeFilter, selectedPlace, selectedPlaceId, searchHistory } = s;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === '/' &&
                document.activeElement?.tagName !== 'INPUT' &&
                document.activeElement?.tagName !== 'TEXTAREA' &&
                !document.querySelector('[role="dialog"]')
            ) {
                e.preventDefault();
                inputRef.current?.focus();
                setIsOpen(true);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const results = query === '' && !activeFilter ? s.favoriteStopFeatures : s.stopResults;

    const showDropdown = (results.length > 0 || s.vehicleResults.length > 0 || s.posResults.length > 0 || s.geocodingResults.length > 0 || !!s.queryLines || (query === '' && !activeFilter && searchHistory.length > 0)) && query !== selectedPlace?.name;
    const isListShown = isOpen && showDropdown;

    const clearSearch = (e?: React.MouseEvent) => {
        e?.preventDefault();
        e?.stopPropagation();
        if (activeFilter) s.setRouteFilter(null);
        setQuery('');
    };

    return (
        <div
            className={cn(
                "fixed top-0 left-0 w-[calc(100%-56px)] md:w-105 md:left-1/2 md:-translate-x-1/2 safe-top p-4 md:p-0 md:top-5 z-1000 transition-[left,width] duration-300 ease-in-out",
                isSidebarOpen && "md:left-(--visible-center-x) md:w-90"
            )}
        >
            <Autocomplete.Root
                inline
                mode="none"
                autoHighlight
                open={isListShown}
                onOpenChange={(open, details) => {
                    if (!open && details.reason !== 'item-press') setIsOpen(false);
                }}
                value={s.lineFilterLabel ?? query}
                onValueChange={(value, details) => {
                    if (details.reason !== 'input-change' && details.reason !== 'input-clear') return;
                    if (activeFilter) {
                        s.setRouteFilter(null);
                        setQuery('');
                    } else {
                        setQuery(value);
                    }
                    if (selectedPlaceId) {
                        s.setSelectedPlaceId(null);
                    }
                    setIsOpen(true);
                }}
            >
                <div ref={containerRef}>
                    <div
                        className="flex h-11 glassy rounded-2xl overflow-hidden transition-colors items-center focus-within:ring-2 focus-within:ring-primary/20 shadow-sm"
                        data-testid="search-container"
                    >
                        <CitySwitcher variant="ghost" className="w-12 pl-1 rounded-l-2xl rounded-r-none border-r border-border/40 hover:bg-muted/50" />

                        <div className="relative flex-1 group h-full" onClick={() => inputRef.current?.focus()}>
                            <Autocomplete.Input
                                ref={inputRef}
                                render={<Input />}
                                aria-label={t('search.placeholder')}
                                onFocus={() => setIsOpen(true)}
                                placeholder={t('search.placeholder')}
                                className={cn(
                                    "h-full w-full bg-transparent border-0! pl-10 text-title truncate placeholder:text-sm placeholder:text-muted-foreground/50 focus-visible:ring-0! focus-visible:border-transparent! shadow-none! rounded-none outline-none",
                                    activeFilter && "text-primary font-medium"
                                )}
                                data-testid="search-input"
                                readOnly={!!activeFilter}
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none">
                                <SearchIcon size={18} strokeWidth={2} className={cn(activeFilter && "text-primary")}  />
                            </div>
                            {(query || activeFilter) && (
                                <div className="absolute right-0 top-0 h-full flex items-center pr-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                            if (selectedPlaceId) s.setSelectedPlaceId(null);
                                            clearSearch();
                                            inputRef.current?.focus();
                                        }}
                                        className="h-9 w-9 text-muted-foreground hover:bg-muted/50"
                                        aria-label={t('search.clearFilter')}
                                    >
                                        <X size={18} strokeWidth={2}  />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>

                    {isListShown && (
                        <SearchDropdown
                            results={results}
                            searchHistory={searchHistory}
                            favoriteStops={s.favoriteStops}
                            query={query}
                            activeFilter={activeFilter}
                            queryLines={s.queryLines}
                            vehicleResults={s.vehicleResults}
                            geocodingResults={s.geocodingResults}
                            posResults={s.posResults}
                            onStopSelect={s.selectStop}
                            onHistorySelect={s.selectHistory}
                            onLineSelect={s.selectLine}
                            onPlaceSelect={s.selectPlace}
                            onPosSelect={s.selectPos}
                            onVehicleSelect={s.selectVehicle}
                            lineMetadataMap={s.lineMetadataMap}
                        />
                    )}
                </div>
            </Autocomplete.Root>
        </div>
    );
});

Search.displayName = 'Search';
