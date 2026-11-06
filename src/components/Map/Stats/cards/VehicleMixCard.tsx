import { Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getRouteTypeI18nKey } from '@/domain/routes';
import { fleetAmenityRows, vehicleTypesByCount } from '@/domain/vehicles';
import type { CityStats } from '@/types';
import { StatsCard } from './StatsCard';
import { FactRow } from '@/components/FactRow';

interface VehicleMixCardProps {
    stats: CityStats;
    networkStats?: CityStats | null;
}

/** How many vehicles of each type run, then how many of them are low-floor or air-conditioned. */
export const VehicleMixCard = ({ stats, networkStats }: VehicleMixCardProps) => {
    const { t, i18n } = useTranslation();
    const types = vehicleTypesByCount(stats.vehicle_types ?? {});
    const amenities = fleetAmenityRows(stats, networkStats);
    if (types.length === 0 && !amenities.lowFloor && !amenities.airConditioned) return null;

    const share = (count: number) => {
        if (stats.total_vehicles === 0) return '-';
        const percent = new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'percent', maximumFractionDigits: 0 }).format(count / stats.total_vehicles);
        return `${count} (${percent})`;
    };

    return (
        <StatsCard icon={Activity} title={t('stats.vehicleMix')} iconClassName="text-tint-mint" flush>
            <div className="flex flex-col">
                {types.map(([type, count]) => <FactRow key={type} label={t(getRouteTypeI18nKey(type))} value={count} />)}
                {amenities.lowFloor && <FactRow label={t('stats.lowFloor')} value={share(stats.low_floor_count)} />}
                {amenities.airConditioned && <FactRow label={t('stats.airConditioned')} value={share(stats.air_conditioned_count)} />}
            </div>
        </StatsCard>
    );
};
