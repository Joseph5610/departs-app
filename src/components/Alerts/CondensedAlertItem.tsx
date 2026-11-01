import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, ChevronDown, Maximize2, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { RSSItem } from '@/types';
import { LineBadge } from '@/components/LineBadge';
import { AlertIcon } from './AlertIcon';
import { FALLBACK_ROUTE_COLOR } from '@/config/constants';
import { isHighPriorityAlert } from '@/domain/alerts';
import { formatDateTime, formatStartDate } from '@/domain/time';
import { useCityConfig } from '@/hooks/data/useCities';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface CondensedAlertItemProps {
    item: RSSItem;
    /** For line-scoped contexts: hides line badges and clamps the expanded description. */
    compact?: boolean;
    defaultExpanded?: boolean;
    /** Replaces the external link with an in-app action showing the full alert. */
    onOpenFull?: () => void;
    className?: string;
}

/**
 * CondensedAlertItem
 *
 * An accordion-style list item for alerts, using Shadcn Collapsible.
 */
export const CondensedAlertItem = ({ item, compact = false, defaultExpanded = false, onOpenFull, className }: CondensedAlertItemProps) => {
    const { t, i18n } = useTranslation();
    const { timezone } = useCityConfig();
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const isHigh = isHighPriorityAlert(item.priority);
    const isNormal = item.priority === 'normal' || item.priority === '2';
    const isFuture = item.isFuture;
    const lines = compact ? undefined : item.resolvedLines;
    // GTFS-RT UNKNOWN_CAUSE (1) and OTHER_CAUSE (2) carry no information worth a label.
    const cause = item.cause === '1' || item.cause === '2' ? undefined : item.cause;

    const iconColorClass = isHigh ? "text-destructive" : isNormal ? "text-tint-amber" : "text-muted-foreground";

    const validFromText = item.valid_from ? formatDateTime(item.valid_from, i18n.resolvedLanguage) : null;
    const validToText = item.valid_from && !item.valid_to ? t('alerts.untilFurtherNotice') : item.valid_to && formatDateTime(item.valid_to, i18n.resolvedLanguage);

    return (
        <Collapsible
            open={isExpanded}
            onOpenChange={setIsExpanded}
            className={cn(
                "group relative block",
                isFuture && "opacity-75 grayscale-[0.3]",
                className
            )}
        >
            <CollapsibleTrigger
                className="row-hover-group flex w-full items-start gap-3 px-3.5 py-3 text-left data-panel-open:[--row-hover-fill:transparent]"
            >
                <div className="shrink-0">
                    <AlertIcon cause={item.cause} effect={item.effect} type={item.type} size={20} strokeWidth={1.75} className={iconColorClass} />
                </div>

                <div className="flex flex-col gap-1 flex-1 min-w-0">
                    {lines && lines.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                            {lines.map((line, idx) => (
                                <LineBadge
                                    key={`${line.name}-${idx}`}
                                    name={line.name}
                                    routeColor={line.route_color || FALLBACK_ROUTE_COLOR}
                                    size="row"
                                />
                            ))}
                        </div>
                    )}

                    <div className={cn(
                        "type-row font-semibold leading-tight text-foreground/95 whitespace-pre-line",
                        !isExpanded && "line-clamp-2"
                    )}>
                        {item.title}
                    </div>

                    {isFuture && item.valid_from && (
                        <div className="flex items-center gap-1.5 type-note text-muted-foreground">
                            <CalendarClock size={12} strokeWidth={2} className="shrink-0" />
                            <span>{t('alerts.startsAt', { date: formatStartDate(item.valid_from, i18n.resolvedLanguage, timezone) })}</span>
                        </div>
                    )}
                </div>

                <div className="shrink-0 pt-0.5 text-label-3 transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
                    <ChevronDown size={17} strokeWidth={1.75} />
                </div>
            </CollapsibleTrigger>

            <CollapsibleContent>
                <div className="pr-3.5 pb-3.5 pl-11.5">
                    <div className="flex flex-col gap-3">
                        {(cause || item.causeDetail) && (
                            <div className="type-label text-muted-foreground flex items-center flex-wrap gap-y-1">
                                {cause && <span>{t(`alerts.causes.${cause}`, cause)}</span>}
                                {item.causeDetail && (
                                    <span className={cn(
                                        "normal-case font-medium",
                                        cause ? "ml-1.5" : ""
                                    )}>
                                        {i18n.resolvedLanguage === 'en' && item.causeDetail.en ? item.causeDetail.en : item.causeDetail.cs}
                                    </span>
                                )}
                            </div>
                        )}
                        {item.description && (
                            <div className={cn(
                                "type-note font-medium leading-relaxed text-foreground/80 whitespace-pre-wrap",
                                compact && "line-clamp-5"
                            )}>
                                {item.description}
                            </div>
                        )}

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                            {item.valid_from && (
                                <Badge variant="info">
                                    {validToText ? `${validFromText} – ${validToText}` : t('alerts.validFrom', { date: validFromText })}
                                </Badge>
                            )}
                            {onOpenFull ? (
                                <Button variant="link" size="inline" onClick={onOpenFull}>
                                    <Maximize2 size={12} strokeWidth={2} />
                                    {t('alerts.showFull')}
                                </Button>
                            ) : item.link && (
                                <Button
                                    variant="link"
                                    size="inline"
                                    render={<a href={item.link} target="_blank" rel="noopener noreferrer" />}
                                >
                                    <ExternalLink size={12} strokeWidth={2} />
                                    {t('alerts.moreInfo')}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
};
