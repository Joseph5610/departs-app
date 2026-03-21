
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
    lines?: string[];
    lineColors?: (line: string) => string;
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
    lines,
    lineColors
}) => {
    const { t } = useTranslation();
    const isHigh = priority === 'high' || priority === '1';
    const isNormal = priority === 'normal' || priority === '2';
    
    const alertVariant = isHigh ? 'destructive' : 'default';

    const CardContent = (
        <Alert 
            variant={alertVariant}
            className={cn(
                "relative transition-all overflow-hidden glassy-tinted p-3 sm:p-4 rounded-2xl border-white/15!",
                isHigh && "!bg-destructive/20 !border-destructive/50 shadow-[0_0_12px_rgba(239,68,68,0.15)]",
                isNormal && "!bg-amber-500/15 !border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.15)]",
                link && "hover:brightness-125 cursor-pointer group",
                isFuture && "opacity-60 grayscale-[0.3]"
            )}
        >
            <AlertTriangle className={cn(
                "h-4 w-4 mt-0.5 shrink-0",
                isHigh ? "!text-destructive animate-pulse" : isNormal ? "!text-amber-500" : "text-muted-foreground"
            )} />
            
            <AlertTitle className={cn("flex flex-col gap-1 mb-2", link && "pr-6 sm:pr-8")}>
                {showStatus && (isFuture ? (
                    <HStack gap={1} className="mb-0.5">
                        <Box className="w-1 h-1 rounded-full bg-destructive animate-pulse" />
                        <span className="text-[8px] font-bold text-destructive/80 uppercase tracking-widest">
                            {t('alerts.planned')}
                        </span>
                    </HStack>
                ) : isActive ? (
                    <HStack gap={1} className="mb-0.5">
                        <Box className="w-1 h-1 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)] animate-pulse" />
                        <span className="text-[8px] font-bold text-primary uppercase tracking-widest">
                            {t('alerts.active')}
                        </span>
                    </HStack>
                ) : null)}
                
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
                    <p className="text-[11px] line-clamp-3 leading-normal text-foreground/90 font-medium">
                        {description}
                    </p>
                )}

                {(lines && lines.length > 0 && lineColors) || validFrom ? (
                    <Stack gap={2}>
                        {lines && lines.length > 0 && lineColors && (
                            <HStack gap={1} className="flex-wrap">
                                {lines.map(line => (
                                    <span
                                        key={line}
                                        className="px-2.5 py-1 rounded-md text-[10px] font-bold text-white shadow-sm ring-1 ring-white/10"
                                        style={{ backgroundColor: lineColors(line) }}
                                    >
                                        {line}
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
                    <ExternalLink size={12} />
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
