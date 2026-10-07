import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { differenceInSeconds, parseISO } from 'date-fns';
import { cn } from 'cn';
import { WALKING } from '@/config/constants';
import { useNow } from '@/hooks/useNow';

interface CountdownProps {
    timestamp: string;
}

/**
 * Countdown
 *
 * Time left until a departure, ticking on the app-wide clock so every row updates together.
 */
export const Countdown = ({ timestamp }: CountdownProps) => {
    const { t } = useTranslation();
    
    const targetDate = useMemo(() => parseISO(timestamp), [timestamp]);

    const now = useNow();
    const secondsLeft = differenceInSeconds(targetDate, now);

    if (secondsLeft <= 0) {
        return <span className="text-emerald-400 animate-pulse">{t('map.departures.now')}</span>;
    }

    const hrs = Math.floor(secondsLeft / 3600);
    const mins = Math.floor((secondsLeft % 3600) / 60);
    const secs = secondsLeft % 60;

    const formatted = hrs > 0
        ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        : `${mins}:${secs.toString().padStart(2, '0')}`;

    return (
        <span className={cn(secondsLeft < WALKING.CATCH_BUFFER_S ? 'text-emerald-400' : 'text-foreground')}>
            {formatted}
        </span>
    );
};
