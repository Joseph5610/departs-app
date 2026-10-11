import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { DEPARTURES_CONFIG, UI_TIMING_MS, WALKING } from '@/config/constants';
import { useNowEvery } from '@/hooks/useNow';
import { useCityConfig } from '@/hooks/data/useCities';
import { minutesCountdown, formatTimetableClock } from '@/domain/time';

interface MinutesUntilProps {
    timestamp: string;
}

/**
 * MinutesUntil
 *
 * A glanceable countdown for the home sheet: "Now", whole minutes below an hour, then the city clock
 * time. Green while the departure is still catchable at a run. Boards use the to-the-second `Countdown`.
 */
export const MinutesUntil = ({ timestamp }: MinutesUntilProps) => {
    const { t } = useTranslation();
    const { timezone } = useCityConfig();
    const now = useNowEvery(UI_TIMING_MS.MINUTES_TICK);
    const countdown = minutesCountdown(timestamp, now, DEPARTURES_CONFIG.COUNTDOWN_MINUTES_LIMIT);

    if (countdown.kind === 'now') {
        return <span className="text-emerald-400">{t('map.departures.now')}</span>;
    }
    if (countdown.kind === 'clock') {
        return <span className="text-foreground">{formatTimetableClock(timestamp, timezone)}</span>;
    }
    return (
        <span className={cn(countdown.minutes * 60 < WALKING.CATCH_BUFFER_S ? 'text-emerald-400' : 'text-foreground')}>
            {t('map.departures.minutes', { count: countdown.minutes })}
        </span>
    );
};
