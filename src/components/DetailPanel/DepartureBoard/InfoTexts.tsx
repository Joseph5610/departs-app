import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from 'cn';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertIcon } from '@/components/Alerts/AlertIcon';
import { useInfotexts } from '@/hooks/data/useInfotexts';
import type { SelectedStop, Infotext } from '@/types';
import { formatDateTime } from '@/domain/time';
import { noticesForStops, noticeText } from '@/domain/alerts';

interface InfoTextsProps {
    selectedStop: SelectedStop;
}

/** The stop's notices (PID infotexts) posted for any of its platform ids. */
export const InfoTexts = ({ selectedStop }: InfoTextsProps) => {
    const allInfotexts = useInfotexts();

    const relevantInfotexts = useMemo(() => {
        if (!selectedStop || !allInfotexts) {
            return [];
        }

        return noticesForStops(allInfotexts, [selectedStop.stop_id, ...(selectedStop.all_ids || [])]);
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

const InfoTextCard = ({ info }: { info: Infotext }) => {
    const { t, i18n } = useTranslation();
    const isHigh = info.priority === 'high';
    const isNormal = info.priority === 'normal';
    const text = noticeText(info, i18n.resolvedLanguage);

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
                    {info.valid_to
                        ? `${formatDateTime(info.valid_from, i18n.resolvedLanguage)} – ${formatDateTime(info.valid_to, i18n.resolvedLanguage)}`
                        : t('alerts.validFrom', { date: formatDateTime(info.valid_from, i18n.resolvedLanguage) })}
                </div>
            </AlertDescription>
        </Alert>
    );
};
