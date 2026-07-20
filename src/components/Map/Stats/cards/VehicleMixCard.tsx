import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getRouteTypeI18nKey } from '../../../../utils/transitUtils';
import type { AppCityStats } from '../../../../../functions/_core/types';

interface VehicleMixCardProps {
    stats: AppCityStats;
}

export const VehicleMixCard: React.FC<VehicleMixCardProps> = ({ stats }) => {
    const { t } = useTranslation();

    if (!stats.vehicle_types || Object.keys(stats.vehicle_types).length === 0) {
        return null;
    }

    return (
        <Card variant="subtle" className="p-0 gap-0 rounded-2xl">
            <CardHeader className="p-3.5 pb-2 space-y-0">
                <CardTitle className="flex items-center gap-2 text-[14px]">
                    <Activity size={16} className="text-primary" />
                    <span>{t('stats.vehicleMix')}</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 pt-0">
                <div className="flex flex-wrap gap-2">
                    {Object.entries(stats.vehicle_types)
                        .sort((a, b) => b[1] - a[1])
                        .map(([type, count]) => {
                            const label = t(getRouteTypeI18nKey(type));
                            return (
                                <div key={type} className="flex items-center gap-1.5 bg-muted/50 border border-border/50 px-2.5 py-1 rounded-md">
                                    <span className="text-xs font-medium text-foreground/80">{label}</span>
                                    <span className="text-xs font-bold text-foreground tabular-nums">{count}</span>
                                </div>
                            );
                    })}
                </div>
            </CardContent>
        </Card>
    );
};
