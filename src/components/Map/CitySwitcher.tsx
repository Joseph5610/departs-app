import React, { useState, useEffect, useRef } from 'react';
import { Earth } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCities } from '../../hooks/data/useCities';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useMapMetadataStore } from '../../state/mapMetadataStore';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useLocation } from 'wouter';
import { CitySelectionList } from './CitySelectionList';
import { cn } from '@/lib/utils';

interface CitySwitcherProps {
    className?: string;
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "tinted";
}

export const CitySwitcher: React.FC<CitySwitcherProps> = ({ className, variant = "tinted" }) => {
    const { t } = useTranslation();
    const { data } = useCities();
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const { setSelectedCity } = usePreferencesStore(s => s.actions);
    const mapRef = useMapMetadataStore(s => s.mapRef);
    const [open, setOpen] = useState(false);
    const [, navigate] = useLocation();
    
    // Animation state for when city changes
    const [isHighlighting, setIsHighlighting] = useState(false);
    const prevCityRef = useRef(selectedCity);

    useEffect(() => {
        if (prevCityRef.current !== selectedCity) {
            setIsHighlighting(true);
            const timer = setTimeout(() => setIsHighlighting(false), 2000);
            prevCityRef.current = selectedCity;
            return () => clearTimeout(timer);
        }
    }, [selectedCity]);

    const cities = data?.cities || [];

    // Only render if we have more than 1 city
    if (cities.length <= 1) {
        return null;
    }

    const handleSelectCity = (city: typeof cities[0]) => {
        if (city.slug === selectedCity) {
            setOpen(false);
            return;
        }

        // 1. Change city
        setSelectedCity(city.slug);
        
        // 2. Clear current selection and navigate to the new city map
        navigate(`/${city.slug}`);

        // 3. Move map camera
        const map = mapRef.current?.getMap();
        if (map && city.center) {
            map.flyTo({
                center: city.center as [number, number],
                zoom: 12, // default overview zoom
                duration: 1500
            });
        }

        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <Tooltip>
                <TooltipTrigger render={
                    <DialogTrigger render={
                        <Button
                            variant={variant}
                            size="icon"
                            aria-label={t('map.controls.switchCity')}
                            className={cn(
                                "h-11 w-11 shrink-0 transition-[transform,box-shadow,background-color] duration-500",
                                isHighlighting && "ring-2 ring-primary/80 bg-primary/20 text-primary scale-110 shadow-[0_0_20px_rgba(var(--color-primary),0.4)]",
                                className
                            )}
                            data-testid="map-city-switcher-btn"
                        >
                            <Earth size={20} className={cn("transition-transform", isHighlighting ? "animate-spin" : "group-hover:rotate-12")} strokeWidth={1.5} />
                        </Button>
                    } />
                } />
                <TooltipContent side="bottom" sideOffset={8}>
                    <p className="font-medium text-xs">{t('map.controls.switchCity')}</p>
                </TooltipContent>
            </Tooltip>
            <DialogContent className="sm:max-w-100 p-6 h-auto border-border/40 shadow-2xl">
                <DialogHeader className="pb-4 space-y-1.5">
                    <DialogTitle className="text-xl font-bold">{t('map.controls.switchCity')}</DialogTitle>
                    <p className="text-sm text-muted-foreground/80 font-medium">{t('map.regions.title')}</p>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-4 -mr-4">
                    <CitySelectionList 
                        cities={cities}
                        selectedCitySlug={selectedCity || ''}
                        onSelect={handleSelectCity}
                    />
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};

CitySwitcher.displayName = 'CitySwitcher';
