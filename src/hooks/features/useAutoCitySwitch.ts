import { createElement, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Building2 } from 'lucide-react';
import { useCityConfig, useVisibleCities } from '@/hooks/data/useCities';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useMapMetadataStore } from '@/state/mapMetadataStore';
import { navigate } from '@/lib/history';
import { matchRoutePath, withCitySegment } from '@/lib/routes';
import { cityOverviewCamera } from '@/lib/map/view';
import { nearestCityCentreIn, overlapsBounds, pickCity, stopsInBox, type Box } from '@/domain/cities';
import { useNetworkCoverage } from '@/hooks/data/useNetworkCoverage';

const viewBox = (map: { getBounds(): { getWest(): number; getSouth(): number; getEast(): number; getNorth(): number } }): Box => {
    const b = map.getBounds();
    return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
};

/**
 * 1. Automatically switches the active city in preferencesStore when the selected network has
 *    (almost) no stops left in view and another has; where networks share ground, the selected one stays.
 * 2. Automatically flies the map to the selected city's center if the selectedCity 
 *    changes (e.g. via URL) and the map is currently outside its bounds.
 */
export const useAutoCitySwitch = () => {
    const { t } = useTranslation();
    const cities = useVisibleCities();
    const coverages = useNetworkCoverage();
    const cityConfig = useCityConfig();
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const hasSeenWelcome = usePreferencesStore(s => s.hasSeenWelcome);
    
    const mapRef = useMapMetadataStore(s => s.mapRef);
    const mapLoaded = useMapMetadataStore(s => s.mapLoaded);

    const prevCity = useRef(selectedCity);
    /** A city the map switched to itself, already in view: it must not be flown to. */
    const autoSwitchedTo = useRef<string | null>(null);
    const initialWelcomeSeen = useRef(hasSeenWelcome);
    const isFirstChange = useRef(true);

    useEffect(() => {
        if (prevCity.current !== selectedCity) {
            const wasFirstChange = isFirstChange.current;
            isFirstChange.current = false;
            
            const initiallyNotSeen = !initialWelcomeSeen.current;
            
            if (!(initiallyNotSeen && wasFirstChange)) {
                if (cityConfig.name) {
                    toast(t('map.controls.switchedCity', { city: cityConfig.name }), {
                        icon: createElement(Building2, { className: "w-4 h-4 text-primary" })
                    });
                }
            }
            prevCity.current = selectedCity;
        }
    }, [selectedCity, cityConfig.name, t]);

    useEffect(() => {
        if (!mapLoaded || !mapRef.current || cities.length === 0) {
            return;
        }

        const map = mapRef.current.getMap();

        const handleMoveEnd = (e: { originalEvent?: Event }) => {
            if (!e.originalEvent) {
                return;
            }
            
            // An open vehicle, stop or point of sale belongs to its city; switching would lose it.
            const { tripId, stopId, posId } = matchRoutePath(window.location.pathname);
            if (tripId || stopId || posId) return;

            const center = map.getCenter();
            const currentSelectedCity = usePreferencesStore.getState().selectedCity;

            const box = viewBox(map);
            const newCity = pickCity(cities, coverages, box, currentSelectedCity) ?? nearestCityCentreIn(cities, box, [center.lng, center.lat]);

            if (newCity && newCity.slug !== currentSelectedCity) {
                autoSwitchedTo.current = newCity.slug;
                usePreferencesStore.getState().actions.setSelectedCity(newCity.slug);
                
                // The URL follows too, so useRouteParams doesn't revert it; camera params (lat, lng, z) are kept.
                const newUrl = `${withCitySegment(window.location.pathname, newCity.slug)}${window.location.search}`;

                navigate(newUrl, { replace: true });
            }
        };

        map.on('moveend', handleMoveEnd);

        return () => {
            map.off('moveend', handleMoveEnd);
        };
    }, [mapLoaded, mapRef, cities, coverages, t]);

    // State -> map sync: fly to a city selected elsewhere (a link, the switcher) when the map shows none of it.
    const coveragesRef = useRef(coverages);
    useEffect(() => {
        coveragesRef.current = coverages;
    }, [coverages]);
    const citySlug = cityConfig.slug;
    const cityRef = useRef(cityConfig);
    useEffect(() => {
        cityRef.current = cityConfig;
    }, [cityConfig]);

    useEffect(() => {
        if (!mapLoaded || !mapRef.current) return;
        if (autoSwitchedTo.current === citySlug) {
            autoSwitchedTo.current = null;
            return;
        }

        const map = mapRef.current.getMap();
        const city = cityRef.current;
        const coverage = coveragesRef.current.get(citySlug);
        const hasStopsInView = coverage ? stopsInBox(coverage, viewBox(map)) > 0 : overlapsBounds(city, viewBox(map));
        // Already showing the city, or its centre: the user got there themselves.
        if (!hasStopsInView && !map.getBounds().contains(city.center)) {
            map.flyTo(cityOverviewCamera(city.center));
        }
    }, [citySlug, mapLoaded, mapRef]);
};
