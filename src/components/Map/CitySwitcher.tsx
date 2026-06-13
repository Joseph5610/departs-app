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
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';

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
            <DialogContent className="sm:max-w-[400px] p-6 h-auto">
                <DialogHeader className="pb-2">
                    <DialogTitle>{t('map.controls.switchCity')}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh]">
                    <div className="flex flex-col gap-1.5">
                        {cities.map(city => {
                            const isSelected = selectedCity === city.slug;
                            return (
                                <button
                                    key={city.slug}
                                    onClick={() => handleSelectCity(city)}
                                    className={cn(
                                        "w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all duration-200 outline-none",
                                        isSelected 
                                            ? "border-primary bg-primary/10 text-primary-foreground"
                                            : "border-transparent bg-white/5 hover:bg-white/10 hover:border-white/10 text-foreground"
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-base font-medium">{city.name}</span>
                                        {city.isBeta && (
                                            <span className="bg-amber-500/20 text-amber-500 text-[9px] px-1.5 py-0.5 rounded-sm uppercase tracking-wider font-bold">Beta</span>
                                        )}
                                    </div>
                                    {isSelected && <Check size={18} className="text-primary" strokeWidth={2.5} />}
                                </button>
                            );
                        })}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};

CitySwitcher.displayName = 'CitySwitcher';
