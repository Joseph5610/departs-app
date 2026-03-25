import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { differenceInSeconds, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface CountdownProps {
    timestamp: string;
}

/**
 * Countdown
 *
 * Logic-only component for time display.
 */
export const Countdown: React.FC<CountdownProps> = ({ timestamp }) => {
    const { t } = useTranslation();
    const [secondsLeft, setSecondsLeft] = useState(() =>
        differenceInSeconds(parseISO(timestamp), new Date())
    );

    useEffect(() => {
        const interval = setInterval(() => {
            setSecondsLeft(differenceInSeconds(parseISO(timestamp), new Date()));
        }, 1000);

        return () => clearInterval(interval);
    }, [timestamp]);

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
        <span className={cn(secondsLeft < 120 ? 'text-emerald-400' : 'text-foreground')}>
            {formatted}
        </span>
    );
};

Countdown.displayName = 'Countdown';
