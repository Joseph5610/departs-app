import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { useInfotexts } from '@/hooks/data/useInfotexts';
import { AlertIcon } from '@/components/Alerts/AlertIcon';
import { noticeBannerTone, noticeIconTone } from '@/components/Alerts/noticeTone';
import { activeNotices, noticesForStops, noticeText } from '@/domain/alerts';
import { BOARD_CONFIG } from '@/config/constants';

/** The stop's current notices in the board's footer, one at a time. */
export const BoardNotices = ({ stopIds, now }: { stopIds: string[]; now: number }) => {
    const { i18n } = useTranslation();
    const infotexts = useInfotexts();
    const notices = useMemo(() => noticesForStops(infotexts ?? [], stopIds), [infotexts, stopIds]);
    const active = activeNotices(notices, now);
    if (active.length === 0) return null;

    const index = Math.floor(now / BOARD_CONFIG.NOTICE_ROTATE_MS) % active.length;
    const info = active[index];
    return (
        <footer className={cn(
            "flex items-center gap-[0.75em] border-t px-board-gutter py-[clamp(0.6rem,1.6vh,1.25rem)] text-board-notice font-semibold",
            noticeBannerTone(info.priority)
        )}>
            <AlertIcon className={cn("size-[1.2em] shrink-0", noticeIconTone(info.priority))} />
            <span key={info.id} className="min-w-0 line-clamp-2 whitespace-pre-line animate-in fade-in duration-500">{noticeText(info, i18n.resolvedLanguage)}</span>
            {active.length > 1 && (
                <span className="ml-auto shrink-0 tabular-nums font-medium text-muted-foreground">
                    {index + 1}/{active.length}
                </span>
            )}
        </footer>
    );
};
