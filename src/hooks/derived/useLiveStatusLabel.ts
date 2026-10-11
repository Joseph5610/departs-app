import { useTranslation } from 'react-i18next';
import { liveStatus } from '@/domain/departures';
import { formatDelay } from '@/domain/delay';
import type { Departure } from '@/types';

/** A departure's live state in words, for its status dot's tooltip: on time, late or early by how much, or no live data. */
export const useLiveStatusLabel = (dep: Pick<Departure, 'isCanceled' | 'delay'>): string | null => {
    const { t } = useTranslation();
    const status = liveStatus(dep);
    const delay = formatDelay(Math.abs(dep.delay ?? 0))?.slice(1) ?? '';
    if (status === 'canceled') return null;
    if (status === 'timetable') return t('map.departures.liveStatus.timetable');
    if (status === 'onTime') return t('map.departures.onTime');
    return t(status === 'late' ? 'map.departures.liveStatus.late' : 'map.departures.liveStatus.early', { delay });
};
