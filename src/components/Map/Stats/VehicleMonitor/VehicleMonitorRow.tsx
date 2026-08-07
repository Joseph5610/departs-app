import React from 'react';
import { useTranslation } from 'react-i18next';
import { navigate } from 'wouter/use-browser-location';
import { ChevronRight } from 'lucide-react';
import { LineBadge } from '../../../LineBadge';
import { Badge } from '@/components/ui/badge';
import { usePreferencesStore } from '../../../../state/preferencesStore';
import { useSelectionStore } from '../../../../state/selectionStore';
import { cn } from '@/lib/utils';
import type { EnrichedVehicleItem } from '../../../../hooks/derived/useVehicleMonitor';

interface VehicleMonitorRowProps {
    item: EnrichedVehicleItem;
}

export const VehicleMonitorRow: React.FC<VehicleMonitorRowProps> = React.memo(({ item }) => {
    const { t } = useTranslation();
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const setIsFollowing = useSelectionStore(s => s.actions.setIsFollowing);

    const handleClick = () => {
        setIsFollowing(true);
        if (item.gtfsTripId) {
            if (item.vehicleId) {
                navigate(`/${selectedCity}/trip/${encodeURIComponent(item.gtfsTripId)}/${encodeURIComponent(item.vehicleId)}`);
            } else {
                navigate(`/${selectedCity}/trip/${encodeURIComponent(item.gtfsTripId)}`);
            }
        }
    };

    const delaySeconds = item.delay;
    const delayMinutes = delaySeconds !== null ? Math.round(Math.abs(delaySeconds) / 60) : 0;
    const isLate = delaySeconds !== null && delaySeconds > 30;
    const isEarly = delaySeconds !== null && delaySeconds < -30;

    const displayId = item.vehicleId ? `#${item.vehicleId}` : '—';

    return (
        <div
            onClick={handleClick}
            className="group flex items-center justify-between gap-3 px-3 py-2 border-b border-border/20 hover:bg-muted/40 transition-colors cursor-pointer select-none"
        >
            {/* Left: Line Badge & Vehicle ID */}
            <div className="flex items-center gap-2.5 shrink-0 min-w-36">
                <LineBadge
                    name={item.line}
                    routeColor={item.routeColor}
                    size="md"
                    className="shadow-xs shrink-0"
                />

                <span className="text-xs font-semibold font-mono tracking-tight text-foreground/90 truncate max-w-28">
                    {displayId}
                </span>
            </div>

            {/* Middle Spacer */}
            <div className="flex items-center min-w-0 flex-1" />

            {/* Right: Delay badge & Chevron */}
            <div className="flex items-center gap-2 shrink-0">
                {delaySeconds === null ? (
                    <Badge variant="outline" className="text-[10px] font-medium text-muted-foreground bg-muted/20 border-transparent px-1.5 py-0.5">
                        N/A
                    </Badge>
                ) : (
                    <Badge
                        variant="outline"
                        className={cn(
                            "text-[10px] font-bold tabular-nums px-2 py-0.5 border-transparent shadow-2xs",
                            isLate ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                            isEarly ? "bg-sky-500/10 text-sky-400 border-sky-500/20" :
                            "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        )}
                    >
                        {isLate
                            ? `+${delayMinutes || 1} min`
                            : isEarly
                                ? `-${delayMinutes || 1} min`
                                : t('stats.onTime', 'Na čas')}
                    </Badge>
                )}

                <ChevronRight size={14} className="text-muted-foreground/40 group-hover:text-foreground transition-colors" />
            </div>
        </div>
    );
});

VehicleMonitorRow.displayName = 'VehicleMonitorRow';
