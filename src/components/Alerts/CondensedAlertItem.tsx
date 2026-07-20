import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RSSItem } from '../../types/transit';
import { LineBadge } from '../LineBadge';
import { AlertIcon } from './AlertIcon';
import { FALLBACK_ROUTE_COLOR } from '../../config/constants';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface CondensedAlertItemProps {
    item: RSSItem;
}

/**
 * CondensedAlertItem
 * 
 * An accordion-style list item for alerts, using Shadcn Collapsible.
 */
export const CondensedAlertItem: React.FC<CondensedAlertItemProps> = ({ item }) => {
    const { t, i18n } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(false);

    const isHigh = item.priority === 'high' || item.priority === '1';
    const isNormal = item.priority === 'normal' || item.priority === '2';
    const isFuture = item.isFuture;
    const lines = item.line_metadata;

    const iconColorClass = isHigh ? "text-destructive" : isNormal ? "text-amber-500" : "text-muted-foreground";

    const validToText = item.valid_from && !item.valid_to ? t('alerts.untilFurtherNotice') : item.valid_to;

    return (
        <Collapsible
            open={isExpanded}
            onOpenChange={setIsExpanded}
            className={cn(
                "group relative transition-all block",
                isExpanded ? "bg-black/[0.02] dark:bg-white/5" : "hover:bg-black/[0.02] dark:hover:bg-white/5",
                isFuture && "opacity-75 grayscale-[0.3]"
            )}
        >
            <CollapsibleTrigger
                className="w-full text-left px-4 py-3 flex items-start gap-3 outline-none"
            >
                {/* Icon Column */}
                <div className="shrink-0 pt-0.5">
                    <AlertIcon cause={item.cause} effect={item.effect} type={item.type} size={16} strokeWidth={1.5} className={iconColorClass} />
                </div>

                {/* Content Column */}
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <div className="flex gap-2 flex-wrap items-center">
                        {/* Lines Badges */}
                        {lines && lines.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                                {lines.map((line, idx) => (
                                    <LineBadge
                                        key={`${line.name}-${idx}`}
                                        name={line.name}
                                        routeColor={line.route_color || FALLBACK_ROUTE_COLOR}
                                        size="md"
                                    />
                                ))}
                            </div>
                        )}

                        {/* Status Badge */}
                        {isFuture ? (
                            <div className="flex gap-1.5 items-center bg-foreground/5 px-1.5 py-0.5 rounded-md border border-border/50">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500/80" />
                                <span className="text-[9px] font-bold text-amber-500/90 uppercase tracking-widest">
                                    {t('alerts.planned')}
                                </span>
                            </div>
                        ) : null}

                    </div>

                    {/* Title */}
                    <div className={cn(
                        "text-sm font-semibold leading-tight text-foreground/95",
                        !isExpanded && "line-clamp-2"
                    )}>
                        {item.title}
                    </div>
                </div>

                {/* Chevron */}
                <div className="shrink-0 pt-1 text-muted-foreground transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
                    <ChevronDown size={16} strokeWidth={1.5} />
                </div>
            </CollapsibleTrigger>

            {/* Expandable Content */}
            <CollapsibleContent>
                <div className="px-4 pb-4 pt-1 ml-7">
                    <div className="flex flex-col gap-3">
                        {item.cause && (
                            <div className="text-[10px] font-bold text-foreground/70 uppercase tracking-wider flex items-center flex-wrap gap-y-1">
                                <span>{t(`alerts.causes.${item.cause}`, item.cause)}</span>
                                {item.causeDetail && (
                                    <span className="text-foreground/50 ml-1.5 normal-case font-medium border-l border-border/50 pl-1.5">
                                        {i18n.language.startsWith('en') && item.causeDetail.en ? item.causeDetail.en : item.causeDetail.cs}
                                    </span>
                                )}
                            </div>
                        )}
                        {item.description && (
                            <div className="text-[12px] leading-relaxed text-foreground/80 font-medium whitespace-pre-wrap">
                                {item.description}
                            </div>
                        )}

                        {item.link && (
                            <a 
                                href={item.link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary hover:text-primary/80 transition-colors w-fit mt-1"
                            >
                                <ExternalLink size={12} strokeWidth={2} />
                                {t('alerts.moreInfo')}
                            </a>
                        )}

                        {item.valid_from && (
                            <div className="text-[11px] font-medium text-foreground/70 bg-black/5 dark:bg-white/10 px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 inline-flex w-fit shadow-inner">
                                {validToText ? `${item.valid_from} – ${validToText}` : t('alerts.validFrom', { date: item.valid_from })}
                            </div>
                        )}
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
};

CondensedAlertItem.displayName = 'CondensedAlertItem';
