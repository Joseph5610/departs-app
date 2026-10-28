import { useCallback } from 'react';
import { navigate } from '@/lib/history';
import { paths } from '@/lib/routes';
import { cityOverviewCamera } from '@/lib/map/view';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useMapMetadataStore } from '@/state/mapMetadataStore';
import type { CityFacts } from '@shared/cities';

/** Switches to another city: selects it, opens its map route and flies the camera to its overview. */
export const useSelectCity = () => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const { setSelectedCity } = usePreferencesStore(s => s.actions);
    const mapRef = useMapMetadataStore(s => s.mapRef);

    return useCallback((city: CityFacts) => {
        if (city.slug === selectedCity) return;
        setSelectedCity(city.slug);
        navigate(paths.city(city.slug));
        const map = mapRef.current?.getMap();
        if (map && city.center) map.flyTo(cityOverviewCamera(city.center as [number, number]));
    }, [selectedCity, setSelectedCity, mapRef]);
};
