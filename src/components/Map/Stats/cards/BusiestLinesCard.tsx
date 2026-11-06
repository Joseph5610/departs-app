import { Hash } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LineBadge } from '@/components/LineBadge';
import { FALLBACK_ROUTE_COLOR } from '@/config/constants';
import type { CityStats } from '@/types';
import { StatsCard } from './StatsCard';
import { StatRow } from '@/components/Map/Stats/StatRow';

interface BusiestLinesCardProps {
    stats: CityStats;
}

export const BusiestLinesCard = ({ stats }: BusiestLinesCardProps) => {
    const { t } = useTranslation();
    if (!stats.busiest_lines || stats.busiest_lines.length === 0) return null;

    return (
        <StatsCard icon={Hash} title={t('stats.busiestLines')} iconClassName="text-fuchsia-400" flush>
            <div className="flex flex-col">
                {stats.busiest_lines.map(item => (
                    <StatRow
                        key={item.line}
                        label={<LineBadge name={item.line} routeColor={item.route_color || FALLBACK_ROUTE_COLOR} size="row" />}
                        value={`${item.count} ${t('stats.cars')}`}
                    />
                ))}
            </div>
        </StatsCard>
    );
};
