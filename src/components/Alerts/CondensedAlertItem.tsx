import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ExternalLink, ChevronDown, Construction } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Box, Stack, HStack } from '@/components/ui/layout';
import type { RSSItem } from '../../types/transit';
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
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(false);

    const isHigh = item.priority === 'high' || item.priority === '1';
    const isNormal = item.priority === 'normal' || item.priority === '2';
    const isFuture = item.isFuture;
    const lines = item.line_metadata;

    const validToText = item.valid_from && !item.valid_to ? t('alerts.untilFurtherNotice') : item.valid_to;

    return (
        <Collapsible
            open={isExpanded}
            onOpenChange={setIsExpanded}
            className={cn(
                "group relative border-b border-white/5 last:border-0 transition-colors block",
                isExpanded ? "bg-muted/20" : "hover:bg-muted/10",
                isFuture && "opacity-75 grayscale-[0.3]"
            )}
        >
            <CollapsibleTrigger
                className="w-full text-left px-4 py-3 flex items-start gap-3 outline-none"
            >
                {/* Icon Column */}
                <Box className="shrink-0 pt-0.5">
                    {item.type === 'exclusion' ? (
                        <Construction size={16} strokeWidth={1.5} className={cn(
                            isHigh ? "text-destructive" : isNormal ? "text-amber-500" : "text-muted-foreground"
                        )} />
                    ) : (
                        <AlertTriangle size={16} strokeWidth={1.5} className={cn(
                            isHigh ? "text-destructive" : isNormal ? "text-amber-500" : "text-muted-foreground"
                        )} />
                    )}
                </Box>

                {/* Content Column */}
                <Stack gap={1} className="flex-1 min-w-0">
                    <HStack gap={2} className="flex-wrap items-center">
                        {/* Lines Badges */}
                        {lines && lines.length > 0 && (
                            <HStack gap={1} className="flex-wrap">
                                {lines.map((line, idx) => (
                                    <span
                                        key={`${line.name}-${idx}`}
                                        className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white shadow-sm"
                                        style={{ backgroundColor: line.route_color }}
                                    >
                                        {line.name}
                                    </span>
                                ))}
                            </HStack>
                        )}

                        {/* Status Badge */}
                        {isFuture ? (
                            <HStack gap={1}>
                                <Box className="w-1.5 h-1.5 rounded-full bg-destructive" />
                                <span className="text-[9px] font-bold text-destructive/80 uppercase tracking-widest">
                                    {t('alerts.planned')}
                                </span>
                            </HStack>
                        ) : null}
                    </HStack>

                    {/* Title */}
                    <div className={cn(
                        "text-sm font-semibold leading-tight",
                        !isExpanded && "line-clamp-2",
                        isHigh ? "text-destructive" : isNormal ? "text-amber-500" : "text-foreground"
                    )}>
                        {item.title}
                    </div>
                </Stack>

                {/* Chevron */}
                <Box className="shrink-0 pt-1 text-muted-foreground transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
                    <ChevronDown size={16} strokeWidth={1.5} />
                </Box>
            </CollapsibleTrigger>

            {/* Expandable Content */}
            <CollapsibleContent>
                <Box className="px-4 pb-4 pt-1 ml-7">
                    <Stack gap={3}>
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
                            <Box className="text-[11px] font-medium text-muted-foreground bg-background/50 px-3 py-1.5 rounded-lg border border-white/5 inline-flex w-fit">
                                {validToText ? `${item.valid_from} – ${validToText}` : t('alerts.validFrom', { date: item.valid_from })}
                            </Box>
                        )}
                    </Stack>
                </Box>
            </CollapsibleContent>
        </Collapsible>
    );
};

CondensedAlertItem.displayName = 'CondensedAlertItem';
