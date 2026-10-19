import { useRouteParams } from '@/hooks/useRouteParams';
import { useResolvedStop } from '@/hooks/data/useStops';

/** The stop the URL opens (or `stopId`, when given), resolved against the selected city's stop list. */
export const useSelectedStop = (stopId?: string | null) => {
    const route = useRouteParams();
    return useResolvedStop(stopId === undefined ? route.stopId : stopId);
};
