import { useTranslation } from 'react-i18next';
import { Hand } from 'lucide-react';
import { TapHint } from '@/components/TapHint';

/** The hand of a request stop, explaining itself when tapped. */
export const RequestStopMark = ({ size = 16 }: { size?: number }) => {
    const { t } = useTranslation();
    return (
        <TapHint className="rounded-full text-muted-foreground" hint={t('map.vehicleDetails.requestStop')}>
            <Hand size={size} strokeWidth={1.75} aria-label={t('map.vehicleDetails.requestStop')} />
        </TapHint>
    );
};
