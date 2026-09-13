import React from 'react';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DistributionSegment {
    key: string;
    label: string;
    count: number;
    barClass: string;
    textClass: string;
    /** Segments like "unknown" can stay in the bar without a legend entry. */
    hideInLegend?: boolean;
}

interface DistributionBarProps {
    segments: DistributionSegment[];
    total: number;
}

/** Stacked bar of vehicle shares with a count popover per segment and a percentage legend. */
export const DistributionBar: React.FC<DistributionBarProps> = ({ segments, total }) => {
    const { t, i18n } = useTranslation();
    const percent = new Intl.NumberFormat(i18n.language, { style: 'percent', maximumFractionDigits: 0 });

    return (
        <div className="flex flex-col gap-2">
            <div className="h-3.5 w-full flex rounded-full overflow-hidden opacity-90 border border-border/50 shadow-inner">
                {segments.map(segment => (
                    <Popover key={segment.key}>
                        <PopoverTrigger className="h-full block p-0 border-none" style={{ width: `${(segment.count / total) * 100}%` }}>
                            <div className={`${segment.barClass} h-full cursor-pointer hover:opacity-80 transition-opacity w-full`} />
                        </PopoverTrigger>
                        <PopoverContent className="w-auto px-3 py-1.5 text-sm" side="top">
                            {segment.label}: {segment.count} {t('stats.vehicles')}
                        </PopoverContent>
                    </Popover>
                ))}
            </div>
            <div className="flex flex-wrap justify-between text-[10px] font-bold text-foreground/60 uppercase tracking-wider gap-x-3 gap-y-1 mt-1">
                {segments.filter(segment => !segment.hideInLegend).map(segment => (
                    <span key={segment.key} className={segment.textClass}>
                        {segment.label} ({percent.format(segment.count / total)})
                    </span>
                ))}
            </div>
        </div>
    );
};
