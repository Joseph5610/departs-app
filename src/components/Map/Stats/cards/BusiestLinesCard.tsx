import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Hash } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LineBadge } from '../../../LineBadge';
import type { AppCityStats } from '../../../../../functions/_core/types';

interface BusiestLinesCardProps {
    stats: AppCityStats;
}

export const BusiestLinesCard: React.FC<BusiestLinesCardProps> = ({ stats }) => {
    const { t } = useTranslation();

    if (!stats.busiest_lines || stats.busiest_lines.length === 0) {
        return null;
    }

    return (
        <Card variant="subtle" className="p-0 gap-0 rounded-2xl">
            <CardHeader className="p-3.5 pb-2 space-y-0">
                <CardTitle className="flex items-center gap-2 text-[14px]">
                    <Hash size={16} className="text-fuchsia-400" />
                    <span>{t('stats.busiestLines')}</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 pt-0">
                <div className="flex flex-wrap gap-2">
                    {stats.busiest_lines.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 bg-muted/50 border border-border/50 px-2 py-1 rounded-md">
                            <LineBadge 
                                name={item.line} 
                                routeColor={item.route_color || '#5A5A5A'} 
                                size="sm"
                            />
                            <span className="text-xs font-bold text-foreground tabular-nums">{item.count} {t('stats.cars')}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};
