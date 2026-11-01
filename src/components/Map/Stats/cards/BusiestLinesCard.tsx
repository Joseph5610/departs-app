import { Badge } from '@/components/ui/badge';
import { StatsCard } from './StatsCard';
import { Hash } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LineBadge } from '@/components/LineBadge';
import type { CityStats } from '@/types';
import { FALLBACK_ROUTE_COLOR } from '@/config/constants';

interface BusiestLinesCardProps {
    stats: CityStats;
}

export const BusiestLinesCard = ({ stats }: BusiestLinesCardProps) => {
    const { t } = useTranslation();

    if (!stats.busiest_lines || stats.busiest_lines.length === 0) {
        return null;
    }

    return (
        <StatsCard icon={Hash} title={t('stats.busiestLines')} iconClassName="text-fuchsia-400">
                <div className="flex flex-wrap gap-2">
                    {stats.busiest_lines.map((item) => (
                        <Badge key={item.line} variant="info" className="pl-1.5">
                            <LineBadge 
                                name={item.line} 
                                routeColor={item.route_color || FALLBACK_ROUTE_COLOR}
                                size="row"
                            />
                            <span className="type-control text-foreground tabular-nums">{item.count} {t('stats.cars')}</span>
                        </Badge>
                    ))}
                </div>
        </StatsCard>
    );
};
