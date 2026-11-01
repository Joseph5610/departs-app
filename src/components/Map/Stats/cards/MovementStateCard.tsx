import { StatsCard } from './StatsCard';
import { Navigation2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CityStats } from '@/types';
import { DistributionBar } from '@/components/Map/Stats/DistributionBar';

interface MovementStateCardProps {
    stats: CityStats;
}

export const MovementStateCard = ({ stats }: MovementStateCardProps) => {
    const { t } = useTranslation();

    const total = stats.total_vehicles;
    if (!stats.state_distribution || total <= 0) {
        return null;
    }

    const { in_transit, at_stop, off_track, other } = stats.state_distribution;

    return (
        <StatsCard icon={Navigation2} title={t('stats.movementState')} iconClassName="text-sky-400">
                <div className="mt-1">
                    <DistributionBar
                        total={total}
                        segments={[
                            { key: 'inTransit', label: t('stats.inTransit'), count: in_transit, barClass: 'bg-sky-400', textClass: 'text-sky-400' },
                            { key: 'atStop', label: t('stats.atStop'), count: at_stop, barClass: 'bg-indigo-400', textClass: 'text-indigo-400' },
                            { key: 'offTrack', label: t('stats.offTrack'), count: off_track, barClass: 'bg-amber-500', textClass: 'text-tint-amber' },
                            { key: 'other', label: t('stats.unknownState'), count: other, barClass: 'bg-foreground/20', textClass: '', hideInLegend: true },
                        ]}
                    />
                </div>
        </StatsCard>
    );
};
