import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertIcon } from '../../Alerts/AlertIcon';
import { useGlobalAlerts } from '../../../hooks/data/useGlobalAlerts';
import type { SelectedStop } from '../../../types/transit';
import type { Infotext } from '../../../types/alerts';

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
    const { infotexts } = useGlobalAlerts();
    const allInfotexts = infotexts.data;

    const relevantInfotexts = useMemo(() => {
        if (!selectedStop || !allInfotexts) {
            return [];
        }

        const stopIds = [selectedStop.stop_id, ...(selectedStop.all_ids || [])];
        return allInfotexts.filter(info => info.relatedStopIds.some((id: string) => stopIds.includes(id)));
    }, [selectedStop, allInfotexts]);

    if (relevantInfotexts.length === 0) return null;

    return (
        <div className="flex flex-col gap-2">
            {relevantInfotexts.map(info => (
                <InfoTextCard key={info.id} info={info} />
            ))}
        </div>
    );
};

InfoTexts.displayName = 'InfoTexts';

const InfoTextCard: React.FC<{ info: Infotext }> = ({ info }) => {
    const { t, i18n } = useTranslation();
    const isHigh = info.priority === 'high';
    const isNormal = info.priority === 'normal';
    const text = i18n.resolvedLanguage === 'en' && info.textEn ? info.textEn : info.text;

    return (
        <Alert
            variant={isHigh ? 'destructive' : isNormal ? 'warning' : 'subtle'}
            className="relative p-3 sm:p-4 rounded-2xl"
        >
            <AlertIcon className={cn(
                "h-4 w-4 mt-0.5 shrink-0",
                isHigh ? "text-destructive!" : isNormal ? "text-amber-500!" : "text-muted-foreground"
            )} />

            <AlertTitle className="flex flex-col gap-1 mb-2">
                <span className="font-bold text-sm leading-tight text-foreground/95 whitespace-pre-line">
                    {text}
                </span>
            </AlertTitle>

            <AlertDescription className="grid gap-2">
                <div className="text-[10px] font-semibold text-foreground/60 mt-0.5">
                    {info.valid_to ? `${info.valid_from} – ${info.valid_to}` : t('alerts.validFrom', { date: info.valid_from })}
                </div>
            </AlertDescription>
        </Alert>
    );
};

InfoTextCard.displayName = 'InfoTextCard';
