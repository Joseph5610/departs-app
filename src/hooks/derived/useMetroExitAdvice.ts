import { metroExitAdvice } from '@/domain/rides';
import { useMetroExits } from '@/hooks/data/useMetroExits';
import { memoizeLast } from '@/lib/memoize';
import type { StopTimeFeature } from '@/types';
import type { AppRouteType } from '@shared/api';

const advice = memoizeLast(metroExitAdvice);

/** Which car of a metro trip to ride for the way out at the user's exit (`exitSequence`); null off the metro or where unknown. */
export const useMetroExitAdvice = (city: string, routeType: AppRouteType | undefined, stops: readonly StopTimeFeature[] | undefined, exitSequence: number | null) => {
    const { data } = useMetroExits(city, routeType === 'metro');
    return advice(data, stops, exitSequence);
};
