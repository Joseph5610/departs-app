import { useTranslation } from 'react-i18next';
import { Footprints, MapPin } from 'lucide-react';
import { useNavigate } from '@/hooks/features/useNavigate';
import { formatStopDistance } from '@/hooks/derived/useStopDistance';

interface NavigatePillProps {
    /** Where the walking directions lead; the selected stop when omitted. */
    target?: [number, number];
}

/** The panel's directions pill: walking minutes when near, the distance when far, "open in maps" without a location. */
export const NavigatePill = ({ target }: NavigatePillProps) => {
    const { t, i18n } = useTranslation();
    const { handleNavigate, stopDistanceInfo } = useNavigate(target);

    return (
        <button
            type="button"
            onClick={handleNavigate}
            className="flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border/50 bg-card px-3 font-semibold text-foreground shadow-sm outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            data-testid="board-walk"
        >
            {stopDistanceInfo?.isReasonableWalkingDistance && !stopDistanceInfo.isAtStop ? (
                <>
                    <Footprints size={14} strokeWidth={1.5} />
                    {t('map.departures.minutes', { count: stopDistanceInfo.time })}
                </>
            ) : (
                <>
                    <MapPin size={14} strokeWidth={1.5} />
                    {/* The short form, so the items beside the pill still fit on a narrow phone. */}
                    {stopDistanceInfo?.isAtStop ? t('map.departures.atStopShort')
                        : stopDistanceInfo ? formatStopDistance(stopDistanceInfo, t, i18n.language)
                        : t('map.departures.openInMaps')}
                </>
            )}
        </button>
    );
};
