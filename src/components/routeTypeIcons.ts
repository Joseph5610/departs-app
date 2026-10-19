import { Bus, CableCar, Ship, Train, TrainFront, TramFront, createLucideIcon, type LucideIcon } from 'lucide-react';
import type { RouteType } from '@/types';
import { TROLLEYBUS_ICON_NODE } from '@/lib/trolleybusGlyph';

/** Lucide has no trolleybus: its bus under trolley poles, as the map's stop badges draw it. */
export const Trolleybus = createLucideIcon('trolleybus', TROLLEYBUS_ICON_NODE);

/** Icon for each transport mode wherever modes are listed or filtered. */
export const ROUTE_TYPE_ICONS: Record<Exclude<RouteType, 'unknown'>, LucideIcon> = {
    metro: TrainFront,
    train: Train,
    tram: TramFront,
    trolleybus: Trolleybus,
    bus: Bus,
    ferry: Ship,
    funicular: CableCar,
};
