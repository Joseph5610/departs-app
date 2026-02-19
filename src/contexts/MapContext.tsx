import React, { createContext, useContext } from 'react';
import { useMapLogic } from '../hooks/useMapLogic';
import type { MapRef } from 'react-map-gl/maplibre';

/**
 * The full type of the map context, derived from the useMapLogic hook
 */
type MapContextType = ReturnType<typeof useMapLogic>;

const MapContext = createContext<MapContextType | null>(null);

/**
 * Provider component that wraps the map logic and distributes it via context.
 * This eliminates prop-drilling in the main Map component and its children.
 */
export const MapProvider: React.FC<{
    children: React.ReactNode;
    mapRef: React.RefObject<MapRef | null>;
}> = ({ children, mapRef }) => {
    const mapLogic = useMapLogic(mapRef);

    return (
        <MapContext.Provider value={mapLogic}>
            {children}
        </MapContext.Provider>
    );
};

/**
 * Hook to access the map context.
 * Throws an error if used outside of a MapProvider.
 */
export const useMap = () => {
    const context = useContext(MapContext);
    if (!context) {
        throw new Error('useMap must be used within a MapProvider');
    }
    return context;
};
