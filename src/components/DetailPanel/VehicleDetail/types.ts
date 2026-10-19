import type { VehicleDetail } from '@/types';

/** The selected vehicle plus the fields the panel derives from it once. */
export interface DisplayVehicle extends VehicleDetail {
    routeName: string;
    isStaticFallback: boolean;
    effectiveSequence: number | null;
}

export type TimelineStop = Required<Required<DisplayVehicle>['stop_times']>['features'][number];

export interface StopTimelineProps {
    stopTimes: TimelineStop[];
    routeName: DisplayVehicle['routeName'];
    effectiveSequence: DisplayVehicle['effectiveSequence'];
    delay?: number | null;
    tripId: string;
    /** The live vehicle on the trip; a ride needs one to follow. */
    vehicleId: string | null;
    hasEnded: boolean;
}

export interface VehicleHeroProps {
    displayVehicle: DisplayVehicle;
    isFollowing: boolean;
    onToggleFollow: () => void;
    isDetailLoading?: boolean;
    /** The city streams live patches (push channel), so a vehicle without one is still connecting. */
    hasEnrichment: boolean;
    hasEnded: boolean;
}
