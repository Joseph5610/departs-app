import type { VehicleCollection, VehicleFeature, VehicleProperties } from '@/types';
import { calculateDistance, hasPosition } from '@/lib/geo';

/** What makes a neighbouring network's vehicle the same as one of the selected network's. */
export interface VehicleTwinRule {
    radiusM: number;
    /** Two known delays further apart than this are two vehicles. */
    maxDelayGapS: number;
}

type TwinFields = Pick<VehicleProperties, 'route_type' | 'route_short_name' | 'delay'>;

const lineKey = (v: TwinFields) => `${v.route_type}|${String(v.route_short_name ?? '').toUpperCase()}`;

/** Whether `b`, of the same line and mode as `a`, is the same vehicle: within the radius, and with a delay that agrees where both report one. */
const isSameVehicle = (a: TwinFields, aPos: [number, number], b: VehicleFeature, rule: VehicleTwinRule): boolean => {
    const at = b.geometry?.coordinates;
    if (!hasPosition(at) || calculateDistance(aPos, at) > rule.radiusM) return false;
    const x = a.delay, y = b.properties.delay;
    return x == null || y == null || Math.abs(x - y) <= rule.maxDelayGapS;
};

const byLine = (collection: VehicleCollection): Map<string, VehicleFeature[]> => {
    const index = new Map<string, VehicleFeature[]>();
    for (const f of collection.features) {
        const list = index.get(lineKey(f.properties));
        if (list) list.push(f);
        else index.set(lineKey(f.properties), [f]);
    }
    return index;
};

/**
 * `other` without the vehicles the selected network already shows: one of the same line and mode within
 * `radiusM`, whose delay agrees where both report one (PID and DÚK both list the regional lines between them).
 * Returns `other` itself when none is left out.
 */
export function withoutTwinVehicles(other: VehicleCollection | null, own: VehicleCollection | null | undefined, rule: VehicleTwinRule): VehicleCollection | null {
    if (!other?.features.length || !own?.features.length) return other;
    const ownByLine = byLine(own);
    const isTwin = (f: VehicleFeature) => {
        const pos = f.geometry?.coordinates;
        return hasPosition(pos) && (ownByLine.get(lineKey(f.properties)) ?? []).some(o => isSameVehicle(f.properties, pos, o, rule));
    };
    const kept = other.features.filter(f => !isTwin(f));
    return kept.length === other.features.length ? other : { ...other, features: kept };
}

/** The neighbouring network's report of `vehicle` at `pos`, if `others` holds one (the vehicle panel's link to it). */
export function twinVehicleOf(vehicle: TwinFields, pos: readonly number[] | null | undefined, others: VehicleCollection | null | undefined, rule: VehicleTwinRule): VehicleFeature | undefined {
    if (!hasPosition(pos) || !others?.features.length) return undefined;
    const key = lineKey(vehicle);
    return others.features.find(f => lineKey(f.properties) === key && isSameVehicle(vehicle, pos, f, rule));
}
