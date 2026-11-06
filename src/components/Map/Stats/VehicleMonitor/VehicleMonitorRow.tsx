import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { navigate } from '@/lib/history';
import { paths } from '@/lib/routes';
import { ChevronRight } from 'lucide-react';
import { LineBadge } from '@/components/LineBadge';
import { Badge } from '@/components/ui/badge';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useSelectionStore } from '@/state/selectionStore';
import { cn } from '@/lib/cn';
import { Item } from '@/components/ui/item';
import { getDelayStatus } from '@/domain/delay';
import { vehicleDisplayNumber, type EnrichedVehicleItem } from '@/domain/vehicles';

interface VehicleMonitorRowProps {
    item: EnrichedVehicleItem;
}

export const VehicleMonitorRow = memo(({ item }: VehicleMonitorRowProps) => {
    const { t } = useTranslation();
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const setIsFollowing = useSelectionStore(s => s.actions.setIsFollowing);

    const handleClick = () => {
        setIsFollowing(true);
        if (item.gtfsTripId) {
            navigate(paths.trip(selectedCity, item.gtfsTripId, item.vehicleId));
        }
    };

    const delaySeconds = item.delay;
    const delayMinutes = delaySeconds !== null ? Math.round(Math.abs(delaySeconds) / 60) : 0;
    const delayStatus = delaySeconds !== null ? getDelayStatus(delaySeconds) : 'onTime';
    const isLate = delayStatus === 'late';
    const isEarly = delayStatus === 'early';

    const displayId = item.vehicleId ? `#${vehicleDisplayNumber(item.vehicleId)}` : '—';

    return (
        <Item variant="row" size="none" render={<button type="button" onClick={handleClick} />} className="group justify-between px-3 [--row-sep:0.75rem]">
            <div className="flex items-center gap-2.5 shrink-0 min-w-36">
                <LineBadge
                    name={item.line}
                    routeColor={item.routeColor}
                    size="row"
                    className="shrink-0"
                />

                <span className="type-control font-mono tracking-tight text-foreground/90 truncate max-w-28">
                    {displayId}
                </span>
            </div>

            <div className="flex items-center min-w-0 flex-1" />

            <div className="flex items-center gap-2 shrink-0">
                {delaySeconds === null ? (
                    <Badge variant="muted" className="type-badge text-muted-foreground">
                        {t('map.vehicleDetails.notAvailable')}
                    </Badge>
                ) : (
                    <Badge
                        variant="muted"
                        className={cn("type-badge tabular-nums", isLate ? "bg-destructive/10 text-destructive" : isEarly ? "bg-tint-sky/10 text-tint-sky" : "bg-tint-mint/10 text-tint-mint")}
                    >
                        {isLate
                            ? `+${t('map.departures.minutes', { count: delayMinutes || 1 })}`
                            : isEarly
                                ? `-${t('map.departures.minutes', { count: delayMinutes || 1 })}`
                                : t('stats.onTime')}
                    </Badge>
                )}

                <ChevronRight size={14} className="text-label-3 transition-colors group-hover:text-foreground" />
            </div>
        </Item>
    );
});

VehicleMonitorRow.displayName = 'VehicleMonitorRow';
