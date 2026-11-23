import { FALLBACK_ROUTE_COLOR, STOP_SEARCH } from '@/config/constants';
import { LineBadge } from '@/components/LineBadge';
import type { LineBadgeSize } from '@/lib/lineBadge';
import type { LineBadgeData } from '@/domain/routes';

interface LineBadgesProps {
    lines?: readonly LineBadgeData[];
    size?: LineBadgeSize;
}

/** A stop's or result's lines, each once and at most `STOP_SEARCH.LINE_BADGE_LIMIT`, the rest counted as "+N"; inline, so a text can follow. */
export const LineBadges = ({ lines, size = 'row' }: LineBadgesProps) => {
    if (!lines || lines.length === 0) return null;
    const unique = [...new Map(lines.filter(line => line.name).map(line => [line.name, line])).values()];
    const hidden = unique.length - STOP_SEARCH.LINE_BADGE_LIMIT;
    return (
        <>
            {unique.slice(0, STOP_SEARCH.LINE_BADGE_LIMIT).map(line => (
                <LineBadge key={line.name} name={String(line.name)} routeColor={line.route_color || FALLBACK_ROUTE_COLOR} size={size} className="mr-1.5" />
            ))}
            {hidden > 0 && (
                <span className="mr-1.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-badge bg-fill-2 px-1 type-micro text-muted-foreground">
                    +{hidden}
                </span>
            )}
        </>
    );
};
