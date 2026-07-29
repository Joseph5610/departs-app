import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowRight } from 'lucide-react';
import { STORAGE_KEYS } from '../../config/constants';
import { useGeolocation } from '../../hooks/features/useGeolocation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCities } from '../../hooks/data/useCities';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useMapMetadataStore } from '../../state/mapMetadataStore';
import { useLocation } from 'wouter';
import { DEFAULT_CITY_SLUG } from '../../config/cities';
import { CitySelectionList } from '../Map/CitySelectionList';

/**
 * WelcomeModal
 *
 * Re-architected with semantic layout components.
 */
export const WelcomeModal: React.FC = () => {
    const { t } = useTranslation();
    const { handleLocate } = useGeolocation();
    
    const { data } = useCities();
    const cities = useMemo(() => data?.cities || [], [data?.cities]);
    const globalSelectedCity = usePreferencesStore(s => s.selectedCity);
    const { setSelectedCity } = usePreferencesStore(s => s.actions);
    const mapRef = useMapMetadataStore(s => s.mapRef);
    const [, navigate] = useLocation();

    const [userChosenSlug, setUserChosenSlug] = useState<string | null>(null);

    const activeCitySlug = useMemo(() => {
        if (userChosenSlug && cities.some(c => c.slug === userChosenSlug)) {
            return userChosenSlug;
        }
        if (globalSelectedCity && cities.some(c => c.slug === globalSelectedCity)) {
            return globalSelectedCity;
        }
        return cities[0]?.slug || DEFAULT_CITY_SLUG;
    }, [userChosenSlug, globalSelectedCity, cities]);

    const [isOpen, setIsOpen] = useState(() => {
        if (typeof window === 'undefined') return false;
        
        const path = window.location.pathname;
        const isHomepage = path === '/';
        
        // Skip welcome modal on any deep links or city subpaths, and mark it as seen
        if (!isHomepage) {
            localStorage.setItem(STORAGE_KEYS.WELCOME_SEEN, 'true');
            return false;
        }

        const params = new URLSearchParams(window.location.search);
        if (params.has('skipTutorial')) return false;
        return !localStorage.getItem(STORAGE_KEYS.WELCOME_SEEN);
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        
        if (params.has('skipTutorial')) {
            localStorage.setItem(STORAGE_KEYS.WELCOME_SEEN, 'true');
            handleLocate();

            const url = new URL(window.location.href);
            url.searchParams.delete('skipTutorial');
            window.history.replaceState({}, '', url.toString());
        }
    }, [handleLocate]);

    const handleClose = () => {
        localStorage.setItem(STORAGE_KEYS.WELCOME_SEEN, 'true');
        setIsOpen(false);
        handleLocate();

        if (activeCitySlug) {
            const city = cities.find(c => c.slug === activeCitySlug);
            if (city) {
                if (city.slug !== globalSelectedCity) {
                    setSelectedCity(city.slug);
                    navigate(`/${city.slug}`);
                    
                    const map = mapRef.current?.getMap();
                    if (map && city.center) {
                        map.flyTo({
                            center: city.center as [number, number],
                            zoom: 12,
                            duration: 1500
                        });
                    }
                }
            }
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent aria-describedby={undefined} variant="default" showCloseButton={false} className="h-fit gap-8! p-6!">
                <DialogHeader className="space-y-4 pt-2">
                    <div className="flex justify-center">
                        <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center p-0 border border-border/50 shadow-2xl overflow-hidden relative">
                            <div className="absolute inset-0 bg-primary/20 blur-xl"></div>
                            <img src="/pwa-192x192.png" alt="App Logo" className="w-full h-full object-cover rounded-2xl relative z-10" />
                        </div>
                    </div>
                    <DialogTitle className="text-center flex flex-col items-center justify-center gap-1.5 text-2xl">
                        <div className="flex items-center gap-2">
                            {t('welcome.title')}
                            <Badge variant="soft" className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider mt-0.5">
                                {t('welcome.beta')}
                            </Badge>
                        </div>
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground text-center leading-relaxed max-w-80 mx-auto">
                        {t('welcome.description')}
                    </p>
                </DialogHeader>
                <div className="flex flex-col gap-6 mt-2">

                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-4 px-2">
                            <div className="h-px flex-1 bg-linear-to-r from-transparent to-border"></div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                {t('welcome.chooseCity', { defaultValue: 'Select Region' })}
                            </span>
                            <div className="h-px flex-1 bg-linear-to-l from-transparent to-border"></div>
                        </div>
                        <CitySelectionList 
                            cities={cities}
                            selectedCitySlug={activeCitySlug}
                            onSelect={(c) => setUserChosenSlug(c.slug)}
                        />
                    </div>

                    <Button
                        size="xl"
                        onClick={handleClose}
                        data-testid="welcome-cta"
                        className="w-full transition-colors flex items-center justify-center gap-2 group font-bold"
                    >
                        {t('welcome.cta')}
                        <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform"  strokeWidth={1.5} />
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

WelcomeModal.displayName = 'WelcomeModal';
