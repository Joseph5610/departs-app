import { useTranslation } from 'react-i18next';
import { Footprints, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
        <Button
            variant="secondary"
            size="sm"
            onClick={handleNavigate}
            className="shrink-0 gap-1.5 pl-2.5"
            data-testid="board-walk"
        >
            {stopDistanceInfo?.isReasonableWalkingDistance && !stopDistanceInfo.isAtStop ? (
                <>
                    <Footprints strokeWidth={1.75} className="size-3.75" />
                    {t('map.departures.minutes', { count: stopDistanceInfo.time })}
                </>
            ) : (
                <>
                    <MapPin strokeWidth={1.75} className="size-3.75" />
                    {/* The short form, so the items beside the pill still fit on a narrow phone. */}
                    {stopDistanceInfo?.isAtStop ? t('map.departures.atStopShort')
                        : stopDistanceInfo ? formatStopDistance(stopDistanceInfo, t, i18n.language)
                        : t('map.departures.openInMaps')}
                </>
            )}
        </Button>
    );
};
