import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { differenceInSeconds, parseISO } from 'date-fns';
import { useNow } from '@/hooks/useNow';

interface CountdownProps {
    timestamp: string;
}

/**
 * Countdown
 *
 * Time left until a departure, ticking on the app-wide clock so every row updates together: "4:09" within
 * the hour, "1 h 12 min" beyond it, so it never reads like a clock time. The row's status dot
 * carries its colour.
 */
export const Countdown = ({ timestamp }: CountdownProps) => {
    const { t } = useTranslation();
    
    const targetDate = useMemo(() => parseISO(timestamp), [timestamp]);

    const now = useNow();
    const secondsLeft = differenceInSeconds(targetDate, now);

    if (secondsLeft <= 0) {
        return <span className="animate-pulse text-emerald-600 dark:text-emerald-400">{t('map.departures.now')}</span>;
    }

    if (secondsLeft >= 3600) {
        const hours = Math.floor(secondsLeft / 3600);
        const minutes = Math.floor((secondsLeft % 3600) / 60);
        return <span>{minutes === 0 ? t('map.departures.hours', { hours }) : t('map.departures.hoursMinutes', { hours, minutes })}</span>;
    }

    return <span>{`${Math.floor(secondsLeft / 60)}:${(secondsLeft % 60).toString().padStart(2, '0')}`}</span>;
};
