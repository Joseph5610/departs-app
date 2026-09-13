import { Bus, CableCar, Ship, Train, TrainFront, TramFront, type LucideIcon } from 'lucide-react';
import type { RouteType } from '../types/transit';

/** Icon for each transport mode wherever modes are listed or filtered. */
export const ROUTE_TYPE_ICONS: Record<Exclude<RouteType, 'unknown'>, LucideIcon> = {
    metro: TrainFront,
    train: Train,
    tram: TramFront,
    trolleybus: Bus,
    bus: Bus,
    ferry: Ship,
    funicular: CableCar,
};
