import { useTranslation } from 'react-i18next';
import { Footprints } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { StopDistanceInfo } from '@/domain/stops';

/** How far a stop is: "at the stop", the walk in minutes, or the plain distance when it is too far to walk. */
export const WalkDistance = ({ info, className }: { info: StopDistanceInfo; className?: string }) => {
    const { t } = useTranslation();
    if (info.isAtStop) return <span className={cn("text-xs text-primary", className)}>{t('map.departures.atStop')}</span>;
    if (!info.isReasonableWalkingDistance) {
        return (
            <span className={cn("text-xs text-muted-foreground", className)}>
                {info.distance >= 1000
                    ? t('map.departures.kilometers', { distance: (info.distance / 1000).toFixed(1) })
                    : t('map.departures.meters', { distance: info.distance })}
            </span>
        );
    }
    return (
        <span className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
            <Footprints size={12} strokeWidth={1.75} aria-hidden="true" />
            {t('map.departures.minutes', { count: info.time })}
        </span>
    );
};
