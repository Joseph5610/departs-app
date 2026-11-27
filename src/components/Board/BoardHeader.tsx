import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PlatformCircle } from '@/components/PlatformCircle';
import { SITE } from '@shared/site';

interface BoardHeaderProps {
    name: string | undefined;
    /** The stop's platform code, in a circle before its name. */
    code: string | undefined;
    now: number;
    timeZone: string;
}

/** The board's stop name and the city's clock, signed with the app's name. */
export const BoardHeader = ({ name, code, now, timeZone }: BoardHeaderProps) => {
    const { i18n } = useTranslation();
    const clock = useMemo(() => new Intl.DateTimeFormat(i18n.resolvedLanguage, { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }), [i18n.resolvedLanguage, timeZone]);
    return (
        <header className="flex items-center gap-board-gap border-b border-border px-board-gutter py-[clamp(0.75rem,2vh,1.75rem)]">
            <h1 className="flex min-w-0 flex-1 items-center gap-[0.3em] text-board-display font-bold leading-none">
                {code && <PlatformCircle code={code} size="fluid" />}
                <span className="truncate">{name ?? '…'}</span>
            </h1>
            <div className="shrink-0 text-right">
                <div className="text-board-display font-bold tabular-nums leading-none">{clock.format(now)}</div>
                <div className="mt-[0.5em] text-board-meta text-muted-foreground">{SITE.NAME}</div>
            </div>
        </header>
    );
};
