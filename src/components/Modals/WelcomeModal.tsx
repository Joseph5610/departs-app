import { useState, useEffect, useMemo, useRef, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowRight } from 'lucide-react';
import { useLocate, locateAfterWelcome } from '@/hooks/features/useGeolocation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useVisibleCities } from '@/hooks/data/useCities';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useMapMetadataStore } from '@/state/mapMetadataStore';
import { navigate, replaceUrl } from '@/lib/history';
import { paths } from '@/lib/routes';
import { DEFAULT_CITY_SLUG } from '@/config/cities';
import { CitySelectionList } from '@/components/Map/CitySelectionList';
import { cityOverviewCamera } from '@/lib/map/view';

/**
 * WelcomeModal
 *
 * Re-architected with semantic layout components.
 */
export const WelcomeModal = memo(() => {
    const { t } = useTranslation();
    const handleLocate = useLocate();
    const cities = useVisibleCities();
    const globalSelectedCity = usePreferencesStore(s => s.selectedCity);
    const hasSeenWelcome = usePreferencesStore(s => s.hasSeenWelcome);
    const { setSelectedCity, setHasSeenWelcome } = usePreferencesStore(s => s.actions);
    const mapRef = useMapMetadataStore(s => s.mapRef);

    const ctaRef = useRef<HTMLButtonElement>(null);
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

    const isHomepage = typeof window !== 'undefined' && window.location.pathname === '/';
    const isSkipTutorial = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('skipTutorial');
    
    useEffect(() => {
        if (typeof window === 'undefined') return;

        if (!isHomepage && !hasSeenWelcome) {
            setHasSeenWelcome(true);
        }

        if (isSkipTutorial) {
            setHasSeenWelcome(true);
            handleLocate();

            const url = new URL(window.location.href);
            url.searchParams.delete('skipTutorial');
            replaceUrl(url.toString());
        }
    }, [isHomepage, hasSeenWelcome, isSkipTutorial, setHasSeenWelcome, handleLocate]);

    const isOpen = isHomepage && !hasSeenWelcome && !isSkipTutorial;

    const handleClose = () => {
        setHasSeenWelcome(true);
        locateAfterWelcome();

        if (activeCitySlug) {
            const city = cities.find(c => c.slug === activeCitySlug);
            if (city) {
                if (city.slug !== globalSelectedCity) {
                    setSelectedCity(city.slug);
                    navigate(paths.city(city.slug));
                    
                    const map = mapRef.current?.getMap();
                    if (map && city.center) {
                        map.flyTo(cityOverviewCamera(city.center as [number, number]));
                    }
                }
            }
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent
                aria-describedby={undefined}
                variant="default"
                showCloseButton={false}
                initialFocus={ctaRef}
                className="h-fit max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] max-w-md gap-3 p-5 short:max-w-2xl short:flex-row short:gap-5"
            >
                <DialogHeader className="shrink-0 items-center gap-2 text-center short:w-5/12 short:justify-center short:border-r short:border-border/60 short:pr-5">
                    <div className="size-11 mb-1 bg-black rounded-xl flex items-center justify-center p-0 border border-border/50 shadow-2xl overflow-hidden relative">
                        <div className="absolute inset-0 bg-primary/20 blur-xl"></div>
                        <img src="/pwa-192x192.png" alt="" className="w-full h-full object-cover rounded-xl relative z-10" />
                    </div>
                    <DialogTitle className="flex flex-wrap items-center justify-center gap-2 text-xl font-semibold">
                        {t('welcome.title')}
                        <Badge variant="beta">{t('common.beta')}</Badge>
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground leading-snug max-w-80 text-balance">
                        {t('welcome.description')}
                    </p>
                </DialogHeader>
                <div className="flex min-h-0 flex-1 flex-col gap-2">
                    <div className="flex shrink-0 items-center gap-4 px-2">
                        <div className="h-px flex-1 bg-linear-to-r from-transparent to-border"></div>
                        <span className="micro-label-widest text-muted-foreground/60">
                            {t('welcome.chooseCity')}
                        </span>
                        <div className="h-px flex-1 bg-linear-to-l from-transparent to-border"></div>
                    </div>
                    <div className="min-h-0 flex-1 -mx-2 px-2 py-0.5 overflow-y-auto overflow-x-hidden overscroll-contain">
                        <CitySelectionList
                            cities={cities}
                            selectedCitySlug={activeCitySlug}
                            onSelect={(c) => setUserChosenSlug(c.slug)}
                            size="compact"
                        />
                    </div>
                    <Button
                        ref={ctaRef}
                        size="xl"
                        onClick={handleClose}
                        data-testid="welcome-cta"
                        className="w-full shrink-0 mt-1 h-11 transition-colors flex items-center justify-center gap-2 group font-semibold"
                    >
                        {t('welcome.cta')}
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
});

WelcomeModal.displayName = 'WelcomeModal';
