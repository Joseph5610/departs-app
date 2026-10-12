import { useCityConfig } from '@/hooks/data/useCities';
import { useNowEvery } from '@/hooks/useNow';
import { memoizeLast } from '@/lib/memoize';
import { openingStatus } from '@/domain/pointsOfSale';
import { secondsOfDayIn, weekdayIn } from '@/domain/time';
import type { PointOfSale } from '@/types';

const MINUTE_MS = 60_000;

const statusAt = memoizeLast(openingStatus);

/** Today's weekday and whether the point of sale is open now, in the city's own time zone; re-evaluated each minute. */
export const usePointOfSaleStatus = (pos: PointOfSale) => {
    const { timezone } = useCityConfig();
    const now = useNowEvery(MINUTE_MS);
    const today = weekdayIn(timezone, now);
    return { today, status: statusAt(pos.openingHours, today, secondsOfDayIn(timezone, now)) };
};
