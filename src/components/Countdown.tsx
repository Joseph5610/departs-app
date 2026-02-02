import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { differenceInSeconds, parseISO } from 'date-fns';

interface CountdownProps {
    timestamp: string;
}

export const Countdown: React.FC<CountdownProps> = ({ timestamp }) => {
    const { t } = useTranslation();
    const [secondsLeft, setSecondsLeft] = useState(() =>
        differenceInSeconds(parseISO(timestamp), new Date())
    );

    useEffect(() => {
        // Initial sync
        setSecondsLeft(differenceInSeconds(parseISO(timestamp), new Date()));

        const interval = setInterval(() => {
            setSecondsLeft(prev => prev - 1);
        }, 1000);

        return () => clearInterval(interval);
    }, [timestamp]);

    if (secondsLeft <= 0) {
        return <span className="text-emerald-400 animate-pulse">{t('map.departures.now')}</span>;
    }

    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;

    // We show MM:SS for everything under 20 minutes
    if (mins < 20) {
        return (
            <span className={mins < 2 ? 'text-emerald-400' : 'text-white'}>
                {mins}:{secs.toString().padStart(2, '0')}
            </span>
        );
    }

    // Over 20 minutes, just show minutes to keep it clean
    return <span className="text-white">{t('map.departures.minutes', { count: mins })}</span>;
};
