import { Badge } from '@/components/ui/badge';
import { StatsCard } from './StatsCard';
import { Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getRouteTypeI18nKey } from '@/domain/routes';
import type { CityStats } from '@/types';

interface VehicleMixCardProps {
    stats: CityStats;
}

export const VehicleMixCard = ({ stats }: VehicleMixCardProps) => {
    const { t } = useTranslation();

    if (!stats.vehicle_types || Object.keys(stats.vehicle_types).length === 0) {
        return null;
    }

    return (
        <StatsCard icon={Activity} title={t('stats.vehicleMix')} iconClassName="text-tint-mint">
                <div className="flex flex-wrap gap-2">
                    {Object.entries(stats.vehicle_types)
                        .sort((a, b) => b[1] - a[1])
                        .map(([type, count]) => {
                            const label = t(getRouteTypeI18nKey(type));
                            return (
                                <Badge key={type} variant="info">
                                    {label}
                                    <span className="type-control text-foreground tabular-nums">{count}</span>
                                </Badge>
                            );
                    })}
                </div>
        </StatsCard>
    );
};
