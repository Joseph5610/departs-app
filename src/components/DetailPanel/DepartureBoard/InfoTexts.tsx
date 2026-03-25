import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Stack } from '@/components/ui/layout';
import { GenericAlertCard } from '../../Alerts/GenericAlertCard';
import { useGlobalAlerts } from '../../../hooks/data/useGlobalAlerts';
import type { SelectedStop } from '../../../types/transit';

interface InfoTextsProps {
    selectedStop: SelectedStop;
}

/**
 * InfoTexts
 *
 * Renders stop-specific alert messages (infotexts) retrieved from the global alerts feed.
 * Filtered by the current stop's IDs.
 */
export const InfoTexts: React.FC<InfoTextsProps> = ({ selectedStop }) => {
    const { i18n } = useTranslation();
    const { infotexts } = useGlobalAlerts();
    const allInfotexts = infotexts.data;

    const relevantInfotexts = useMemo(() => {
        if (!selectedStop || !allInfotexts) {
            return [];
        }

        const stopIds = [selectedStop.stop_id, ...(selectedStop.all_ids || [])];
        return allInfotexts.filter(info => info.relatedStopIds.some(id => stopIds.includes(id)));
    }, [selectedStop, allInfotexts]);

    if (relevantInfotexts.length === 0) return null;

    return (
        <Stack gap={2}>
            {relevantInfotexts.map(info => (
                <GenericAlertCard
                    key={info.id}
                    title={i18n.resolvedLanguage === 'en' && info.textEn ? info.textEn : info.text}
                    priority={info.priority}
                    validFrom={info.valid_from}
                    validTo={info.valid_to}
                    isActive={true}
                />
            ))}
        </Stack>
    );
};

InfoTexts.displayName = 'InfoTexts';
