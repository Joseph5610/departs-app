import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { TapHint } from '@/components/TapHint';

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
export const DistributionBar = ({ segments, total }: DistributionBarProps) => {
    const { t, i18n } = useTranslation();
    const percent = new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'percent', maximumFractionDigits: 0 });

    return (
        <div className="flex flex-col gap-2">
            <div className="h-3.5 w-full flex rounded-full overflow-hidden opacity-90 shadow-inner">
                {segments.map(segment => (
                    <TapHint key={segment.key} className={cn("h-full", segment.barClass)} style={{ width: `${(segment.count / total) * 100}%` }} hint={`${segment.label}: ${segment.count} ${t('stats.vehicles')}`}>
                        {null}
                    </TapHint>
                ))}
            </div>
            <div className="flex flex-wrap justify-between type-note font-medium text-muted-foreground gap-x-3 gap-y-1 mt-1">
                {segments.filter(segment => !segment.hideInLegend).map(segment => (
                    <span key={segment.key} className={segment.count > 0 ? segment.textClass : undefined}>
                        {segment.label} ({percent.format(segment.count / total)})
                    </span>
                ))}
            </div>
        </div>
    );
};
