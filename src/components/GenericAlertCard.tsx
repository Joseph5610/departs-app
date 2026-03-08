
import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Box, Stack, HStack } from '@/components/ui/layout';

export interface CommonAlertProps {
    id?: string;
    title: string;
    description?: string | null;
    link?: string;
    priority: 'high' | 'normal' | 'low' | string;
    validFrom?: string | null;
    validTo?: string | null;
    isActive?: boolean;
    isFuture?: boolean;
    showStatus?: boolean;
    lines?: string[];
    lineColors?: (line: string) => string;
}

/**
 * GenericAlertCard
 *
 * Re-architected with semantic layout components.
 */
export const GenericAlertCard: React.FC<CommonAlertProps> = ({
    title,
    description,
    link,
    priority,
    validFrom,
    validTo,
    isActive,
    isFuture,
    showStatus = false,
    lines,
    lineColors
}) => {
    const { t } = useTranslation();
    const isHigh = priority === 'high' || priority === '1';
    const isNormal = priority === 'normal' || priority === '2';

    const CardContent = (
        <HStack
            className={cn(
                "items-start p-4 rounded-2xl border transition-all overflow-hidden relative gap-4",
                link && "hover:bg-muted/50 cursor-pointer group",
                isHigh ? "bg-destructive/10 border-destructive/20" : isNormal ? "bg-amber-500/10 border-amber-500/20" : "bg-muted/30 border-border",
                isFuture && "opacity-60 grayscale-[0.3]"
            )}
        >
            {isHigh && link && (
                <Box className="absolute top-0 left-0 w-1 h-full bg-destructive" />
            )}

            <Box className={cn(
                "p-2 rounded-full shrink-0",
                isHigh ? "bg-destructive/20 text-destructive" : isNormal ? "bg-amber-500/20 text-amber-500" : "bg-muted text-muted-foreground"
            )}>
                <AlertTriangle size={20} className={isHigh ? 'animate-pulse' : ''} />
            </Box>

            <Stack className="flex-1 min-w-0 gap-1.5">
                <HStack className="justify-between items-start gap-2">
                    <Stack className="gap-1.5 min-w-0">
                        {showStatus && (isFuture ? (
                            <HStack className="gap-1.5">
                                <Box className="w-1 h-1 rounded-full bg-destructive animate-pulse" />
                                <span className="text-[9px] font-black text-destructive/80 uppercase tracking-widest">
                                    {t('alerts.planned')}
                                </span>
                            </HStack>
                        ) : isActive ? (
                            <HStack className="gap-1.5">
                                <Box className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                                <span className="text-[9px] font-black text-primary uppercase tracking-widest">
                                    {t('alerts.active')}
                                </span>
                            </HStack>
                        ) : null)}

                        <h4 className={cn(
                            "font-bold text-sm leading-tight transition-colors",
                            isHigh ? "text-destructive" : isNormal ? "text-amber-500" : "text-foreground",
                            link && "group-hover:text-primary"
                        )}>
                            {title}
                        </h4>
                    </Stack>
                    {link && <ExternalLink size={14} className="text-muted-foreground group-hover:text-foreground shrink-0 mt-0.5" />}
                </HStack>

                {description && (
                    <p className="text-muted-foreground text-[10px] mt-0.5 line-clamp-3 leading-relaxed">
                        {description}
                    </p>
                )}

                {lines && lines.length > 0 && lineColors && (
                    <HStack className="flex-wrap gap-1.5 mt-1">
                        {lines.map(line => (
                            <span
                                key={line}
                                className="px-2 py-0.5 rounded-md text-[10px] font-black text-white shadow-sm"
                                style={{ backgroundColor: lineColors(line) }}
                            >
                                {line}
                            </span>
                        ))}
                    </HStack>
                )}

                {validFrom && (
                    <Box className="text-muted-foreground text-[10px] font-medium mt-0.5">
                        {validTo ? `${validFrom} – ${validTo}` : t('alerts.validFrom', { date: validFrom })}
                    </Box>
                )}
            </Stack>
        </HStack>
    );

    if (link) {
        return (
            <a href={link} target="_blank" rel="noopener noreferrer" className="block outline-none">
                {CardContent}
            </a>
        );
    }

    return CardContent;
};
