import React from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react';
import { useNavigate } from '../../hooks/features/useNavigate';
import type { PointOfSale } from '../../types/pointsOfSale';

interface PointOfSaleHeaderProps {
    pos: PointOfSale;
}

export const PointOfSaleHeader: React.FC<PointOfSaleHeaderProps> = ({ pos }) => {
    const { t } = useTranslation();
    const { handleNavigate } = useNavigate();

    return (
        <div className="px-6 pb-0 shrink-0 flex flex-col gap-2">
            <div className="flex w-full h-7 justify-between items-center">
                <div className="flex items-center h-7 rounded-full bg-card border border-border/50 shadow-sm shrink-0 overflow-hidden">
                    <button 
                        type="button"
                        className="flex items-center h-full px-3 hover:bg-muted active:bg-muted/80 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        onClick={() => handleNavigate([pos.lon, pos.lat])}
                    >
                        <MapPin size={12} className="text-muted-foreground/80 mr-1.5" strokeWidth={1.5} />
                        <span className="font-bold text-foreground text-[11px] tracking-tight whitespace-nowrap">
                            {t('map.departures.openInMaps', 'Open in Maps')}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
};
