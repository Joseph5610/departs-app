import { useGeolocation } from '../../hooks/features/useGeolocation';
import { useMapInterface } from '../../hooks/features/useMapInterface';

// --- ENGINE ---

const MapEngine: React.FC = () => {
    useMapInterface();
    useGeolocation();
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


