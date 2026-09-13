import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Navigation2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CityStats } from '../../../../types/transit';
import { DistributionBar } from '../DistributionBar';

interface MovementStateCardProps {
    stats: CityStats;
}

export const MovementStateCard: React.FC<MovementStateCardProps> = ({ stats }) => {
    const { t } = useTranslation();

    const total = stats.total_vehicles;
    if (!stats.state_distribution || total <= 0) {
        return null;
    }

    const { in_transit, at_stop, off_track, other } = stats.state_distribution;

    return (
        <Card variant="subtle" size="none">
            <CardHeader className="p-3.5 pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                    <Navigation2 size={16} className="text-sky-400" />
                    <span>{t('stats.movementState')}</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 pt-0">
                <div className="mt-1">
                    <DistributionBar
                        total={total}
                        segments={[
                            { key: 'inTransit', label: t('stats.inTransit'), count: in_transit, barClass: 'bg-sky-400', textClass: 'text-sky-400' },
                            { key: 'atStop', label: t('stats.atStop'), count: at_stop, barClass: 'bg-indigo-400', textClass: 'text-indigo-400' },
                            { key: 'offTrack', label: t('stats.offTrack'), count: off_track, barClass: 'bg-amber-500', textClass: 'text-amber-500' },
                            { key: 'other', label: t('stats.unknownState'), count: other, barClass: 'bg-foreground/20', textClass: '', hideInLegend: true },
                        ]}
                    />
                </div>
            </CardContent>
        </Card>
    );
};
