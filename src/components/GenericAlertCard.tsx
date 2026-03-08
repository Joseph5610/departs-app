
import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ExternalLink } from 'lucide-react';

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
        <div className={`p-4 rounded-2xl border flex items-start gap-4 transition-all overflow-hidden relative
            ${link ? 'hover:bg-white/5 cursor-pointer group' : ''}
            ${isHigh ? 'bg-rose-500/10 border-rose-500/20' : isNormal ? 'bg-amber-500/10 border-amber-500/20' : 'bg-white/5 border-white/10'}
            ${isFuture ? 'opacity-60 grayscale-[0.3]' : ''}
        `}>
            {isHigh && link && (
                <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
            )}

            <div className={`p-2 rounded-full shrink-0 ${isHigh ? 'bg-rose-500/20 text-rose-500' : isNormal ? 'bg-amber-500/20 text-amber-500' : 'bg-white/10 text-zinc-400'}`}>
                <AlertTriangle size={20} className={isHigh ? 'animate-pulse' : ''} />
            </div>

            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-col gap-1.5 min-w-0">
                        {showStatus && (isFuture ? (
                            <span className="text-[9px] font-black text-rose-500/80 uppercase tracking-widest flex items-center gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-rose-500 animate-pulse" />
                                {t('alerts.planned')}
                            </span>
                        ) : isActive ? (
                            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                {t('alerts.active')}
                            </span>
                        ) : null)}

                        <h4 className={`font-bold text-sm leading-tight transition-colors ${isHigh ? 'text-rose-500' : isNormal ? 'text-amber-500' : 'text-zinc-200'} ${link ? 'group-hover:text-emerald-400' : ''}`}>
                            {title}
                        </h4>
                    </div>
                    {link && <ExternalLink size={14} className="text-zinc-600 group-hover:text-zinc-400 shrink-0 mt-0.5" />}
                </div>

                {description && (
                    <p className="text-zinc-400 text-[10px] mt-0.5 line-clamp-3 leading-relaxed">
                        {description}
                    </p>
                )}

                {lines && lines.length > 0 && lineColors && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                        {lines.map(line => (
                            <span
                                key={line}
                                className="px-2 py-0.5 rounded-md text-[10px] font-black text-white shadow-sm"
                                style={{ backgroundColor: lineColors(line) }}
                            >
                                {line}
                            </span>
                        ))}
                    </div>
                )}

                {validFrom && (
                    <div className="text-zinc-500 text-[10px] font-medium flex items-center gap-2 mt-0.5">
                        <span>
                            {validTo ? `${validFrom} – ${validTo}` : t('alerts.validFrom', { date: validFrom })}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );

    if (link) {
        return (
            <a href={link} target="_blank" rel="noopener noreferrer" className="block">
                {CardContent}
            </a>
        );
    }

    return CardContent;
};
