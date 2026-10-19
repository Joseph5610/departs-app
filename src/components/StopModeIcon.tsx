import { useMemo } from 'react';
import { MapPin } from 'lucide-react';
import { primaryRouteType } from '@/domain/routes';
import { ROUTE_TYPE_ICONS } from '@/components/routeTypeIcons';
import type { StopLine } from '@/types';

/** The icon of a stop's leading mode (metro, train, tram...), or a pin when it lists no lines. */
export const StopModeIcon = ({ lines, size = 18 }: { lines: readonly StopLine[] | undefined; size?: number }) => {
    const mode = useMemo(() => primaryRouteType((lines ?? []).map(l => l.type)), [lines]);
    const Icon = mode === 'unknown' ? MapPin : ROUTE_TYPE_ICONS[mode];
    return <Icon size={size} strokeWidth={1.75} />;
};
