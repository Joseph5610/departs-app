import React, { useState } from 'react';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCities } from '../../hooks/data/useCities';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useMapMetadataStore } from '../../state/mapMetadataStore';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check } from 'lucide-react';
import { ItemGroup, Item, ItemContent, ItemTitle, ItemActions } from '@/components/ui/item';
import { cn } from '@/lib/utils';
import { navigate } from 'wouter/use-browser-location';

export const CitySwitcher: React.FC = () => {
    const { t } = useTranslation();
    const { data } = useCities();
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const { setSelectedCity } = usePreferencesStore(s => s.actions);
    const mapRef = useMapMetadataStore(s => s.mapRef);
    const [open, setOpen] = useState(false);

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
        
        // 2. Clear current selection (so we don't look for prague stops in brno)
        navigate('/');

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
                    title={t('map.controls.switchCity', 'Switch City')}
                    aria-label={t('map.controls.switchCity', 'Switch City')}
                    className="h-11 w-11"
                    data-testid="map-city-switcher-btn"
                >
                    <Globe size={20} className="transition-transform group-hover:rotate-12" strokeWidth={1.5} />
                </Button>
            } />
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>{t('map.controls.switchCity', 'Vyberte mesto')}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] mt-4">
                    <ItemGroup className="gap-2">
                        {cities.map(city => (
                            <Item
                                key={city.slug}
                                variant={selectedCity === city.slug ? "outline" : "default"}
                                className={cn(
                                    "cursor-pointer transition-colors border",
                                    selectedCity === city.slug 
                                        ? "border-primary bg-primary/10 hover:bg-primary/20" 
                                        : "border-transparent hover:bg-white/5 active:bg-white/10"
                                )}
                                render={<button onClick={() => handleSelectCity(city)} />}
                            >
                                <ItemContent>
                                    <ItemTitle className="text-base">{city.name}</ItemTitle>
                                </ItemContent>
                                {selectedCity === city.slug && (
                                    <ItemActions>
                                        <Check size={18} className="text-primary" strokeWidth={2} />
                                    </ItemActions>
                                )}
                            </Item>
                        ))}
                    </ItemGroup>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};

CitySwitcher.displayName = 'CitySwitcher';
