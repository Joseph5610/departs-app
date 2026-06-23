import React, { useState } from 'react';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCities } from '../../hooks/data/useCities';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useMapMetadataStore } from '../../state/mapMetadataStore';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLocation } from 'wouter';
import { CitySelectionList } from './CitySelectionList';

export const CitySwitcher: React.FC = () => {
    const { t } = useTranslation();
    const { data } = useCities();
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const { setSelectedCity } = usePreferencesStore(s => s.actions);
    const mapRef = useMapMetadataStore(s => s.mapRef);
    const [open, setOpen] = useState(false);
    const [, navigate] = useLocation();

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
            <DialogTrigger render={
                <Button
                    variant="tinted"
                    size="icon"
                    title={t('map.controls.switchCity')}
                    aria-label={t('map.controls.switchCity')}
                    className="h-11 w-11"
                    data-testid="map-city-switcher-btn"
                >
                    <Globe size={20} className="transition-transform group-hover:rotate-12" strokeWidth={1.5} />
                </Button>
            } />
            <DialogContent className="sm:max-w-[400px] p-6 h-auto border-border/40 shadow-2xl">
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
