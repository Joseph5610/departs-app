import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Flag } from 'lucide-react';
import { navigate } from '@/lib/history';
import { paths } from '@/lib/routes';
import { useVehicles } from '@/hooks/data/useVehicles';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useSelectionStore } from '@/state/selectionStore';
import { lastStopOf } from '@/domain/vehicles';
import { formatClock } from '@/domain/time';
import { Button } from '@/components/ui/button';
import type { DisplayVehicle } from './types';
import { HeroNotice } from './HeroNotice';

/** Replaces a finished trip's live state: says it has ended, stops following it, and offers the vehicle's next trip when known. */
export const TripEndedNotice = ({ vehicle, hasEnded }: { vehicle: DisplayVehicle; hasEnded: boolean }) => {
    const { t } = useTranslation();
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const { setIsFollowing } = useSelectionStore(s => s.actions);
    const { vehicleIndex } = useVehicles();

    const stops = vehicle.stop_times?.features ?? [];

    useEffect(() => {
        if (hasEnded) setIsFollowing(false);
    }, [hasEnded, setIsFollowing]);

    if (!hasEnded) return null;

    const lastStop = lastStopOf(stops);
    const live = vehicle.vehicle_id ? vehicleIndex.get(vehicle.vehicle_id)?.properties : undefined;
    const next = live?.gtfs_trip_id && live.gtfs_trip_id !== vehicle.gtfs_trip_id
        ? { tripId: live.gtfs_trip_id, line: String(live.route_short_name ?? '') }
        : lastStop?.properties.continues_as?.trip_id
            ? { tripId: lastStop.properties.continues_as.trip_id, line: lastStop.properties.continues_as.line }
            : null;
    const arrival = lastStop?.properties.realtime_arrival_time || lastStop?.properties.arrival_time;

    return (
        <HeroNotice
            icon={Flag}
            title={t('map.vehicleDetails.ended.title')}
            description={arrival
                ? t('map.vehicleDetails.ended.body', { stop: lastStop?.properties.stop_name, time: formatClock(arrival) })
                : t('map.vehicleDetails.ended.bodyNoTime', { stop: lastStop?.properties.stop_name })}
            tone="text-foreground/90"
            descriptionTone="text-muted-foreground"
        >
            {next && (
                <Button
                    size="sm"
                    onClick={() => navigate(paths.trip(selectedCity, next.tripId, vehicle.vehicle_id))}
                    className="mt-2 self-start"
                >
                    {t('map.vehicleDetails.ended.nextTrip', { line: next.line })}
                </Button>
            )}
        </HeroNotice>
    );
};
