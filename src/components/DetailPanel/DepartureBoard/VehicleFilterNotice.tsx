import { useTranslation } from 'react-i18next';
import { ListFilter } from 'lucide-react';
import { usePreferencesStore } from '@/state/preferencesStore';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface VehicleFilterNoticeProps {
    hiddenCount: number;
}

/** Names the persisted vehicle filters while they hide departures, with a way to show them all again. */
export const VehicleFilterNotice = ({ hiddenCount }: VehicleFilterNoticeProps) => {
    const { t } = useTranslation();
    const requireAirConditioned = usePreferencesStore(s => s.requireAirConditioned);
    const requireWheelchairAccessible = usePreferencesStore(s => s.requireWheelchairAccessible);
    const { clearVehicleFilters } = usePreferencesStore(s => s.actions);

    if (hiddenCount === 0) return null;

    const filters = [
        ...(requireAirConditioned ? [t('map.departures.vehicleFilterAc')] : []),
        ...(requireWheelchairAccessible ? [t('map.departures.vehicleFilterAccessible')] : []),
    ].join(', ');

    return (
        <Alert variant="info" className="items-center px-3 py-2" data-testid="vehicle-filter-notice">
            <ListFilter className="h-4 w-4 shrink-0" />
            <div className="flex min-w-0 items-center gap-2">
                <AlertTitle className="min-w-0 flex-1 text-body-sm font-semibold leading-tight text-foreground/95">
                    {t('map.departures.vehicleFilterNotice', { filters })}
                </AlertTitle>
                <Button variant="link" size="sm" className="h-auto shrink-0 px-0" onClick={clearVehicleFilters}>
                    {t('map.departures.vehicleFilterShowAll')}
                </Button>
            </div>
        </Alert>
    );
};
