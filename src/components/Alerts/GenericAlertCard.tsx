import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Box, Stack, HStack } from '@/components/ui/layout';
import {
    Alert,
    AlertDescription,
    AlertTitle
} from '@/components/ui/alert';

interface GenericAlertCardProps {
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
    lines?: Array<{ name: string; route_color: string; type: string }>;
}

/**
 * GenericAlertCard
 *
 * Final polish: fixed alignment via Alert primitive fix, tightened gaps, and minimal typography.
 */
export const GenericAlertCard: React.FC<GenericAlertCardProps> = ({
    title,
    description,
    link,
    priority,
    validFrom,
    validTo,
    isActive,
    isFuture,
    showStatus = false,
    lines
}) => {
    const { t } = useTranslation();
    const isHigh = priority === 'high' || priority === '1';
    const isNormal = priority === 'normal' || priority === '2';

    const alertVariant = isHigh ? 'destructive' : 'default';

    const CardContent = (
        <Alert
            variant={alertVariant}
            className={cn(
                "relative transition-all overflow-hidden p-3 sm:p-4 rounded-2xl border border-white/10 bg-white/5 shadow-sm",
                isHigh && "bg-destructive/15! border-destructive/40! shadow-[0_0_12px_rgba(239,68,68,0.1)]",
                isNormal && "bg-amber-500/10! border-amber-500/30! shadow-[0_0_12px_rgba(245,158,11,0.1)]",
                link && "hover:bg-white/10 cursor-pointer group active:scale-[0.98]",
                isFuture && "opacity-60 grayscale-[0.3]"
            )}
        >
            <AlertTriangle className={cn(
                "h-4 w-4 mt-0.5 shrink-0",
                isHigh ? "text-destructive!" : isNormal ? "text-amber-500!" : "text-muted-foreground"
            )} />

            <AlertTitle className={cn("flex flex-col gap-1 mb-2", link && "pr-6 sm:pr-8")}>
                <HStack gap={2} align="center" className="mb-1">
                    {showStatus && (isFuture ? (
                        <HStack gap={1} align="center" className="px-1.5 py-0.5 rounded-md bg-destructive/10 border border-destructive/20">
                            <Box className="w-1 h-1 rounded-full bg-destructive animate-pulse" />
                            <span className="text-[8px] font-bold text-destructive uppercase tracking-widest">
                                {t('alerts.planned')}
                            </span>
                        </HStack>
                    ) : isActive ? (
                        <HStack gap={1} align="center" className="px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                            <Box className="w-1 h-1 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--color-primary)]" />
                            <span className="text-[8px] font-bold text-primary uppercase tracking-widest">
                                {t('alerts.active')}
                            </span>
                        </HStack>
                    ) : null)}

                    {isHigh && (
                        <span className="text-[8px] font-bold text-destructive uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-destructive/10 border border-destructive/20">
                            {t('alerts.priorityHigh')}
                        </span>
                    )}
                </HStack>

                <span className={cn(
                    "font-bold text-sm leading-tight transition-colors",
                    isHigh ? "text-destructive" : isNormal ? "text-amber-500" : "text-foreground",
                    link && "group-hover:text-primary"
                )}>
                    {title}
                </span>
            </AlertTitle>

            <AlertDescription className="grid gap-3">
                {description && (
                    <p className="text-[11px] line-clamp-4 leading-relaxed text-foreground/90 font-medium">
                        {description}
                    </p>
                )}

                {(lines && lines.length > 0) || validFrom ? (
                    <Stack gap={2}>
                        {lines && lines.length > 0 && (
                            <HStack gap={1} className="flex-wrap">
                                {lines.map((line, idx) => (
                                    <span
                                        key={`${line.name}-${idx}`}
                                        className="px-2.5 py-1 rounded-md text-[10px] font-bold text-white shadow-sm ring-1 ring-white/10"
                                        style={{ backgroundColor: line.route_color }}
                                    >
                                        {line.name}
                                    </span>
                                ))}
                            </HStack>
                        )}

                        {validFrom && (
                            <Box className="text-[10px] font-semibold text-foreground/60 mt-0.5">
                                {validTo ? `${validFrom} – ${validTo}` : t('alerts.validFrom', { date: validFrom })}
                            </Box>
                        )}
                    </Stack>
                ) : null}
            </AlertDescription>

            {link && (
                <div className="absolute top-3 right-3 p-1.5 rounded-lg bg-foreground/5 text-muted-foreground group-hover:text-foreground group-hover:bg-foreground/10 transition-all">
                    <ExternalLink size={14}  strokeWidth={1.5} />
                </div>
            )}
        </Alert>
    );

    if (link) {
        return (
            <a href={link} target="_blank" rel="noopener noreferrer" className="block outline-none no-underline active:scale-[0.99] transition-transform">
                {CardContent}
            </a>
        );
    }

    return CardContent;
};

GenericAlertCard.displayName = 'GenericAlertCard';
