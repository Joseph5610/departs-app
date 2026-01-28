import { useEffect } from 'react';
import type { VehicleCollection } from '../types/pid';

/**
 * useAnimatedVehicles
 * DEPRECATED: Layers moved to Map.tsx for better React stability.
 * Keeping this file only to avoid breaking imports during transition.
 */
export const useAnimatedVehicles = (data: VehicleCollection | undefined, mapRef: React.MutableRefObject<any>) => {
    // No-op - logic moved to declarative layers in Map.tsx
};
