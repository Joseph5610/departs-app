import React from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    Alert,
    AlertDescription,
    AlertTitle
} from '@/components/ui/alert';
import { LineBadge } from '../LineBadge';
import { FALLBACK_ROUTE_COLOR } from '../../config/constants';
import { AlertIcon } from './AlertIcon';

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
    cause?: string;
    causeDetail?: { cs?: string; en?: string };
    type?: string;
    effect?: string;
    hideCauseText?: boolean;
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
    cause,
    causeDetail,
    type,
    effect,
    hideCauseText = false
}) => {
    const { t, i18n } = useTranslation();
    const isHigh = priority === 'high' || priority === '1';
    const isNormal = priority === 'normal' || priority === '2';

    const alertVariant = isHigh ? 'destructive' : isNormal ? 'warning' : 'subtle';

    const CardContent = (
        <Alert
            variant={alertVariant}
            className={cn(
                "relative transition-[filter,transform] p-3 sm:p-4 rounded-2xl h-full",
                link && "hover:brightness-125 cursor-pointer group",
                isFuture && "opacity-60 grayscale-[0.3]"
            )}
        >
            <AlertIcon cause={cause} effect={effect} type={type} className={cn(
                "h-4 w-4 mt-0.5 shrink-0",
                isHigh ? "text-destructive!" : isNormal ? "text-amber-500!" : "text-muted-foreground"
            )} />

            <AlertTitle className={cn("flex flex-col gap-1 mb-2", link && "pr-6 sm:pr-8")}>
                {showStatus && (isFuture ? (
                    <div className="flex gap-1.5 items-center mb-1 w-fit bg-foreground/5 px-1.5 py-0.5 rounded-md border border-border/50">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500/80" />
                        <span className="text-[8px] font-bold text-amber-500/90 uppercase tracking-widest">
                            {t('alerts.planned')}
                        </span>
                    </div>
                ) : isActive ? (
                    <div className="flex gap-1 items-center mb-0.5">
                        <div className="w-1 h-1 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]" />
                        <span className="text-[8px] font-bold text-primary uppercase tracking-widest">
                            {t('alerts.active')}
                        </span>
                    </div>
                ) : null)}

                <span className={cn(
                    "font-bold text-sm leading-tight transition-colors text-foreground/95 whitespace-pre-line",
                    link && "group-hover:text-primary"
                )}>
                    {title}
                </span>
            </AlertTitle>

            <AlertDescription className="grid gap-2">
                {((cause && !hideCauseText) || causeDetail) && (
                    <div className="text-[10px] font-bold text-foreground/70 uppercase tracking-wider flex items-center flex-wrap gap-y-1">
                        {cause && !hideCauseText && <span>{t(`alerts.causes.${cause}`, cause)}</span>}
                        {causeDetail && (
                            <span className={cn(
                                "normal-case font-medium",
                                (cause && !hideCauseText) ? "text-foreground/50 ml-1.5 border-l border-border/50 pl-1.5" : "text-foreground/80"
                            )}>
                                {i18n.language.startsWith('en') && causeDetail.en ? causeDetail.en : causeDetail.cs}
                            </span>
                        )}
                    </div>
                )}
                {description && (
                    <div className="text-[11px] line-clamp-3 leading-normal text-foreground/90 font-medium whitespace-pre-line">
                        {description}
                    </div>
                )}

                {(lines && lines.length > 0) || validFrom ? (
                    <div className="flex flex-col gap-2">
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

                        {validFrom && (
                            <div className="text-[10px] font-semibold text-foreground/60 mt-0.5">
                                {validTo ? `${validFrom} – ${validTo}` : t('alerts.validFrom', { date: validFrom })}
                            </div>
                        )}
                    </div>
                ) : null}
            </AlertDescription>

            {link && (
                <div className="absolute top-3 right-3 p-1.5 rounded-full bg-foreground/5 text-muted-foreground group-hover:text-foreground group-hover:bg-foreground/10 transition-colors">
                    <ExternalLink size={14}  strokeWidth={1.5} />
                </div>
            )}
        </Alert>
    );

    if (link) {
        return (
            <a href={link} target="_blank" rel="noopener noreferrer" className="block h-full outline-none no-underline active:scale-[0.99] transition-transform">
                {CardContent}
            </a>
        );
    }

    return CardContent;
};

GenericAlertCard.displayName = 'GenericAlertCard';
