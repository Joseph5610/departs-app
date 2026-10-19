import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertIcon } from '@/components/Alerts/AlertIcon';
import { useInfotexts } from '@/hooks/data/useInfotexts';
import type { SelectedStop, Infotext } from '@/types';
import { formatDateTime } from '@/domain/time';
import { boardNotices, noticeText } from '@/domain/alerts';
import { boardStopIds, isStationBoard, platformCodes, platformIdByCode } from '@/domain/stops';
import { useOpenStop } from '@/hooks/features/useOpenStop';
import { noticeIconTone } from '@/components/Alerts/noticeTone';
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
    const openPlatform = useOpenStop();
    const { board } = selectedStop;
    const onStation = !!board && isStationBoard(board);

    const codes = useMemo(() => board && onStation ? platformCodes(board.platforms) : null, [onStation, board]);
    const notices = useMemo(
        () => allInfotexts ? boardNotices(allInfotexts, board ? boardStopIds(board) : [selectedStop.id], codes) : null,
        [selectedStop, board, allInfotexts, codes]);

    const platformIds = useMemo(() => {
        if (!notices?.platformCodes.length || !board) return new Map<string, string | null>();
        return new Map(notices.platformCodes.map(code => [code, platformIdByCode(board.platforms, code)]));
    }, [notices, board]);

    if (!notices || (notices.shown.length === 0 && notices.platformCodes.length === 0)) return null;
    const { shown, platformCodes: codesWithNotices, platformPriority } = notices;

    return (
        <div className="flex flex-col gap-2">
            {shown.map(info => (
                <InfoTextCard key={info.id} info={info} />
            ))}
            {codesWithNotices.length > 0 && <PlatformNoticesCard codes={codesWithNotices} priority={platformPriority} platformIds={platformIds} onOpen={openPlatform} />}
        </div>
    );
};

const alertVariant = (priority: Infotext['priority']) =>
    priority === 'high' ? 'destructive' : priority === 'normal' ? 'warning' : 'subtle';

interface PlatformNoticesCardProps {
    codes: string[];
    priority: Infotext['priority'];
    /** Each code's platform; null where the code names no single one, which is then shown but not linked. */
    platformIds: ReadonlyMap<string, string | null>;
    onOpen: (platformId: string) => void;
}

/** One line for a station's platform notices: the platforms concerned, each opening its own board with them. */
const PlatformNoticesCard = ({ codes, priority, platformIds, onOpen }: PlatformNoticesCardProps) => {
    const { t } = useTranslation();

    return (
        <Alert variant={alertVariant(priority)} className="items-center px-3 py-2.5">
            <AlertIcon className={cn("h-4 w-4 shrink-0", noticeIconTone(priority))} />
            <div className="flex min-w-0 items-center gap-2">
                <AlertTitle className="min-w-0 flex-1 text-body-sm font-semibold leading-tight text-foreground/95">
                    {t('map.departures.stationNotices')}
                </AlertTitle>
                <span className="flex shrink-0 flex-wrap justify-end gap-1">
                    {codes.map(code => (
                        <PlatformNoticeCode key={code} code={code} platformId={platformIds.get(code) ?? null} onOpen={onOpen} />
                    ))}
                </span>
            </div>
        </Alert>
    );
};

const PlatformNoticeCode = ({ code, platformId, onOpen }: { code: string; platformId: string | null; onOpen: (platformId: string) => void }) => {
    const { t } = useTranslation();
    const circle = <PlatformCircle code={code} size="md" />;
    if (!platformId) return <span className="flex" aria-label={t('map.departures.platformCode', { code })}>{circle}</span>;
    return (
        <button
            type="button"
            onClick={() => onOpen(platformId)}
            aria-label={t('map.departures.platformCode', { code })}
            className="flex rounded-full transition-transform active:scale-95 hover:brightness-110"
        >
            {circle}
        </button>
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
            <AlertIcon className={cn("h-4 w-4 mt-0.5 shrink-0", noticeIconTone(info.priority))} />

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
