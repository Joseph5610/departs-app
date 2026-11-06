import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Globe, Search as SearchIcon, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { useSearch } from '@/hooks/features/useSearch';
import { useGeolocationStore } from '@/state/geolocationStore';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useUiStore } from '@/state/uiStore';
import { useVisibleCities } from '@/hooks/data/useCities';
import { MobileSearchResults } from './MobileSearchResults';
import { SHEET } from '@/config/constants';
import { LineFilterLabel } from './LineFilterLabel';
import { Pressable } from '@/components/Pressable';
import { SearchField } from '@/components/SearchField';

/** Opens at the sheet's full height, just below the status bar. */
const SEARCH_SHEET_STYLE = { top: `calc(max(env(safe-area-inset-top, 0px), ${SHEET.FULL_TOP_MIN_INSET_PX}px) + ${SHEET.FULL_TOP_GAP_PX}px)` };

interface MobileSearchProps {
    /** Called after a pick that changes the map (a line filter or a place), so the sheet can get out of the way. */
    onMapPick: () => void;
}

/**
 * The phone's search: a button in the sheet header showing the active line filter or place, and a
 * full-screen search whose field sits at the top so the keyboard never pushes the sheet around.
 */
export const MobileSearch = ({ onMapPick }: MobileSearchProps) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const userLocation = useGeolocationStore(s => s.userLocation);
    const { clearHistory } = usePreferencesStore(s => s.actions);
    const { setIsCityPickerOpen } = useUiStore(s => s.actions);
    const cities = useVisibleCities();

    const s = useSearch(isOpen, (pick) => {
        inputRef.current?.blur();
        setIsOpen(false);
        if (pick === 'map') onMapPick();
    });

    // Focusing inside the tap keeps the keyboard; the full-screen field is already mounted, only transparent.
    const open = () => {
        inputRef.current?.focus();
        setIsOpen(true);
    };

    const close = () => {
        inputRef.current?.blur();
        setIsOpen(false);
        s.setQuery('');
    };

    const activeLabel = s.lineFilterLabel ?? s.selectedPlace?.name ?? null;

    return (
        <>
            <div className="flex shrink-0 gap-2 sheet-row-gutter pb-3">
                <div className="flex h-11 flex-1 min-w-0 items-center overflow-hidden rounded-full bg-field">
                    <Pressable
                        onClick={open}
                        className="flex h-full flex-1 min-w-0 items-center gap-2.25 pl-3.5 pr-2 text-left"
                        data-testid="search-trigger"
                    >
                        <SearchIcon size={18} strokeWidth={1.75} className={activeLabel ? "shrink-0 text-tint-mint" : "shrink-0 text-muted-foreground"} />
                        {s.activeFilterBadges ? (
                            <LineFilterLabel lines={s.activeFilterBadges} />
                        ) : (
                            <span className={cn("truncate type-field", activeLabel ? "font-medium text-foreground" : "text-muted-foreground")}>
                                {activeLabel ?? t('search.placeholder')}
                            </span>
                        )}
                    </Pressable>
                    {activeLabel && (
                        <Button variant="ghost" size="icon-sm" className="mr-1 shrink-0"
                            type="button"
                            onClick={s.clearSelection}
                            aria-label={t('search.clearFilter')}
                            data-testid="search-clear-selection"
                        >
                            <X size={17} strokeWidth={2} />
                        </Button>
                    )}
                </div>
                {cities.length > 1 && (
                    <Button variant="secondary" size="icon" className="shrink-0"
                        type="button"
                        onClick={() => setIsCityPickerOpen(true)}
                        aria-label={t('map.controls.switchCity')}
                        data-testid="city-picker-btn"
                    >
                        <Globe strokeWidth={1.75} className="size-5.25" />
                    </Button>
                )}
            </div>

            {createPortal(
                <div
                    className={cn("fixed inset-0 z-600 [--panel-gutter:1rem] transition-opacity duration-200 ease-out", isOpen ? "opacity-100" : "pointer-events-none opacity-0")}
                    aria-hidden={!isOpen}
                    data-testid="search-overlay"
                >
                    <div aria-hidden="true" className="absolute inset-0 bg-black/25" onClick={close} />
                    <div
                        className={cn(
                            "glassy-thick glassy-edge-top absolute! inset-x-0 bottom-0 flex flex-col rounded-t-sheet pt-4 transition-transform duration-200 ease-out [--glass-material:var(--mat-solid)]",
                            isOpen ? "translate-y-0" : "translate-y-6"
                        )}
                        style={SEARCH_SHEET_STYLE}
                    >
                    <div className="flex shrink-0 items-center gap-2 px-(--panel-gutter) pb-3">
                        <SearchField
                            ref={inputRef}
                            className="flex-1"
                            value={s.query}
                            onValueChange={s.setQuery}
                            onClear={() => { s.setQuery(''); inputRef.current?.focus(); }}
                            clearLabel={t('search.clearFilter')}
                            enterKeyHint="search"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    s.selectTopResult();
                                } else if (e.key === 'Escape') {
                                    close();
                                }
                            }}
                            // iOS can leave the page shifted after its keyboard closes.
                            onBlur={() => window.scrollTo(0, 0)}
                            placeholder={t('search.placeholder')}
                            aria-label={t('search.placeholder')}
                            data-testid="search-input"
                        />
                        <Button variant="secondary" size="icon" onClick={close} aria-label={t('common.cancel')} className="shrink-0 text-muted-foreground" data-testid="search-cancel">
                            <X size={16} strokeWidth={2.5} />
                        </Button>
                    </div>
                    <MobileSearchResults
                        query={s.query}
                        stopResults={s.stopResults}
                        favoriteStops={s.pinnedStopList}
                        location={userLocation}
                        searchHistory={s.searchHistory}
                        queryLines={s.queryLines}
                        queryLineBadges={s.queryLineBadges}
                        vehicleResults={s.vehicleResults}
                        geocodingResults={s.geocodingResults}
                        posResults={s.posResults}
                        onStopSelect={s.selectStop}
                        onHistorySelect={s.selectHistory}
                        onClearHistory={clearHistory}
                        onLineSelect={s.selectLine}
                        onPlaceSelect={s.selectPlace}
                        onPosSelect={s.selectPos}
                        onVehicleSelect={s.selectVehicle}
                    />
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};
