import { useGeolocationWatcher } from '@/hooks/features/useGeolocation';
import { useMapInterface } from '@/hooks/features/useMapInterface';
import { useAutoCitySwitch } from '@/hooks/features/useAutoCitySwitch';
import { useRouteCitySync } from '@/hooks/features/useRouteCitySync';

const MapEngine = () => {
    useRouteCitySync();
    useMapInterface();
    useGeolocationWatcher();
    useAutoCitySwitch();
    return null;
};

/**
 * MapController acts as a headless container for map-related logic and lifecycle.
 * It initializes global map hooks and provides children as-is.
 */
export const MapController = ({ children }: { children: React.ReactNode }) => {
    return (
        <>
            <MapEngine />
            {children}
        </>
    );
};


