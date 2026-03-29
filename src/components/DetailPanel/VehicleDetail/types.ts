import type { VehicleDetailProperties } from '../../../types/transit';

/**
 * DisplayVehicle
 *
 * The merged and enriched vehicle object used by VehicleDetail sub-components.
 * Created by merging `selectedVehicle` (from map stream) with `vehicleDetail` (from API),
 * then adding derived fields like `routeName`, `effectiveSequence`, etc.
 */
export interface DisplayVehicle extends VehicleDetailProperties {
    routeName: string;
    isStaticFallback: boolean;
    effectiveSequence: number | null;
    routeType: string | number;
}

export type StopFeature = Required<Required<DisplayVehicle>['stop_times']>['features'][number];

export interface StopTimelineProps {
    stopTimes: StopFeature[];
    effectiveSequence: DisplayVehicle['effectiveSequence'];
}

export interface VehicleHeroProps {
    displayVehicle: DisplayVehicle;
    isFollowing: boolean;
    onToggleFollow: () => void;
    liveDataAgeSeconds: number | null;
}
