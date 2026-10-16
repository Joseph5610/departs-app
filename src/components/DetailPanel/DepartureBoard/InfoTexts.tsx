import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertIcon } from '@/components/Alerts/AlertIcon';
import { useInfotexts } from '@/hooks/data/useInfotexts';
import type { SelectedStop, Infotext } from '@/types';
import { formatDateTime } from '@/domain/time';
import { boardNotices, highestPlatformPriority, noticeText, type PlatformNotices } from '@/domain/alerts';
import { isStationBoard, platformCodes } from '@/domain/stops';
import { useStops } from '@/hooks/data/useStops';
import { useSelectionStore } from '@/state/selectionStore';
import { PlatformCircle } from '@/components/PlatformCircle';

interface InfoTextsProps {
    selectedStop: SelectedStop;
}

/**
 * The stop's notices (PID infotexts) posted for any of its platform ids. A station board lists only its
 * own notices whole and names the platforms that have theirs; picking one in the filter shows them.
 */
export const InfoTexts = ({ selectedStop }: InfoTextsProps) => {
    const allInfotexts = useInfotexts();
    const { stopIndex } = useStops();
    const selectedPlatform = useSelectionStore(s => s.selectedPlatform);
    const onStation = isStationBoard(selectedStop);

    const { shown, summary } = useMemo(() => {
        if (!allInfotexts) return { shown: [], summary: [] };
        const ids = [selectedStop.stop_id, ...(selectedStop.all_ids || [])];
        const codes = onStation ? platformCodes(selectedStop.all_ids ?? [], stopIndex) : null;
        return boardNotices(allInfotexts, ids, codes, selectedPlatform);
    }, [selectedStop, allInfotexts, onStation, stopIndex, selectedPlatform]);

    if (shown.length === 0 && summary.length === 0) return null;

    return (
        <div className="flex flex-col gap-2">
            {shown.map(info => (
                <InfoTextCard key={info.id} info={info} />
            ))}
            {summary.length > 0 && <PlatformNoticesCard platforms={summary} />}
        </div>
    );
};

const alertVariant = (priority: Infotext['priority']) =>
    priority === 'high' ? 'destructive' : priority === 'normal' ? 'warning' : 'subtle';

const iconTone = (priority: Infotext['priority']) =>
    priority === 'high' ? "text-destructive!" : priority === 'normal' ? "text-amber-500!" : "text-muted-foreground";

/** One card for a station's platform notices: the platforms concerned, each opening its notices through the platform filter. */
const PlatformNoticesCard = ({ platforms }: { platforms: PlatformNotices[] }) => {
    const { t } = useTranslation();
    const { togglePlatformFilter } = useSelectionStore(s => s.actions);
    const priority = highestPlatformPriority(platforms);

    return (
        <Alert variant={alertVariant(priority)} className="relative p-3 sm:p-4 rounded-2xl">
            <AlertIcon className={cn("h-4 w-4 mt-0.5 shrink-0", iconTone(priority))} />
            <AlertTitle className="mb-1 text-sm font-bold leading-tight text-foreground/95">
                {t('map.departures.stationNotices')}
            </AlertTitle>
            <AlertDescription className="grid gap-2">
                <span className="text-label font-semibold text-foreground/60">{t('map.departures.stationNoticesHint')}</span>
                <span className="flex flex-wrap gap-1.5">
                    {platforms.map(({ code }) => (
                        <button
                            key={code}
                            type="button"
                            onClick={() => togglePlatformFilter(code)}
                            aria-label={t('map.departures.platformCode', { code })}
                            className="flex rounded-full transition-transform active:scale-95 hover:brightness-110"
                        >
                            <PlatformCircle code={code} className="size-7 text-body-sm" />
                        </button>
                    ))}
                </span>
            </AlertDescription>
        </Alert>
    );
};

const InfoTextCard = ({ info }: { info: Infotext }) => {
    const { t, i18n } = useTranslation();
    const text = noticeText(info, i18n.resolvedLanguage);

    return (
        <Alert
            variant={alertVariant(info.priority)}
            className="relative p-3 sm:p-4 rounded-2xl"
        >
            <AlertIcon className={cn("h-4 w-4 mt-0.5 shrink-0", iconTone(info.priority))} />

            <AlertTitle className="flex flex-col gap-1 mb-2">
                <span className="font-bold text-sm leading-tight text-foreground/95 whitespace-pre-line">
                    {text}
                </span>
            </AlertTitle>

            <AlertDescription className="grid gap-2">
                <div className="text-label font-semibold text-foreground/60 mt-0.5">
                    {info.valid_to
                        ? `${formatDateTime(info.valid_from, i18n.resolvedLanguage)} – ${formatDateTime(info.valid_to, i18n.resolvedLanguage)}`
                        : t('alerts.validFrom', { date: formatDateTime(info.valid_from, i18n.resolvedLanguage) })}
                </div>
            </AlertDescription>
        </Alert>
    );
};
