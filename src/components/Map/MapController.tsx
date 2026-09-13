import { useGeolocationWatcher } from '../../hooks/features/useGeolocation';
import { useMapInterface } from '../../hooks/features/useMapInterface';
import { useAutoCitySwitch } from '../../hooks/features/useAutoCitySwitch';
import { useRouteCitySync } from '../../hooks/features/useRouteCitySync';

// --- ENGINE ---

const MapEngine: React.FC = () => {
    useRouteCitySync();
    useMapInterface();
    useGeolocationWatcher();
    useAutoCitySwitch();
    return null;
};

// --- CONTROLLER ---

/**
 * MapController acts as a headless container for map-related logic and lifecycle.
 * It initializes global map hooks and provides children as-is.
 */
export const MapController: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <>
            <MapEngine />
            {children}
        </>
    );
};


