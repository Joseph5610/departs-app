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
            <DialogContent className="sm:max-w-[400px] p-6 h-auto border-border/40 shadow-2xl">
                <DialogHeader className="pb-4 space-y-1.5">
                    <DialogTitle className="text-xl font-bold">{t('map.controls.switchCity')}</DialogTitle>
                    <p className="text-sm text-muted-foreground/80 font-medium">{t('map.regions.title')}</p>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-4 -mr-4">
                    <div className="flex flex-col gap-2.5">
                        {cities.map(city => {
                            const isSelected = selectedCity === city.slug;
                            const subtitle = t(`map.regions.${city.slug}`, { defaultValue: '' });

                            // Premium gradient themes for cities

                            return (
                                <button
                                    key={city.slug}
                                    onClick={() => handleSelectCity(city)}
                                    className={cn(
                                        "group relative w-full h-24 flex items-center justify-start gap-5 p-5 rounded-2xl border transition-all duration-300 outline-none overflow-hidden bg-card",
                                        isSelected 
                                            ? "border-primary/50 shadow-[0_0_20px_rgba(16,185,129,0.1)] ring-1 ring-primary/30"
                                            : "border-border/40 hover:border-border/80 hover:shadow-md"
                                    )}
                                >
                                    {/* Subdued Background Wallpaper */}
                                    <div 
                                        className="absolute inset-0 z-0 overflow-hidden pointer-events-none rounded-2xl"
                                        style={{
                                            maskImage: 'linear-gradient(to right, transparent 0%, transparent 35%, black 100%)',
                                            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, transparent 35%, black 100%)'
                                        }}
                                    >
                                        <img 
                                            src={`/cities/${city.slug}.png`} 
                                            alt=""
                                            className={cn(
                                                "absolute right-0 h-full w-auto object-contain mix-blend-lighten transition-all duration-500",
                                                isSelected ? "opacity-80 scale-[2]" : "opacity-30 scale-[1.8] group-hover:opacity-50 group-hover:scale-[1.9]"
                                            )}
                                            style={{ transformOrigin: 'right center' }}
                                        />
                                    </div>
                                    
                                    {/* Checkbox Layer */}
                                    <div className={cn(
                                        "relative z-10 flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all duration-300 shrink-0",
                                        isSelected 
                                            ? "border-primary bg-primary text-primary-foreground shadow-sm" 
                                            : "border-white/20 bg-black/20 text-transparent group-hover:border-white/40"
                                    )}>
                                        <Check size={14} strokeWidth={3} className={cn("transition-transform duration-300", isSelected ? "scale-100" : "scale-50 opacity-0")} />
                                    </div>

                                    {/* Text Layer */}
                                    <div className="relative flex flex-col items-start gap-1 z-10">
                                        <div className="flex items-center gap-2">
                                            <span className={cn(
                                                "text-2xl font-bold tracking-tight transition-colors",
                                                isSelected ? "text-primary" : "text-white"
                                            )}>
                                                {city.name}
                                            </span>
                                            {city.isBeta && (
                                                <span className="bg-amber-500/20 text-amber-500 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
                                                    Beta
                                                </span>
                                            )}
                                        </div>
                                        {subtitle && (
                                            <span className="text-sm text-white/60 font-medium">
                                                {subtitle}
                                            </span>
                                        )}
                                    </div>
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
