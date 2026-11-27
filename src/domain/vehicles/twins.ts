import type { VehicleCollection, VehicleFeature } from '@/types';
import { calculateDistance, hasPosition } from '@/lib/geo';

/** What makes a neighbouring network's vehicle the same as one of the selected network's. */
export interface VehicleTwinRule {
    radiusM: number;
    /** Two known delays further apart than this are two vehicles. */
    maxDelayGapS: number;
}

const lineKey = (f: VehicleFeature) => `${f.properties.route_type}|${String(f.properties.route_short_name ?? '').toUpperCase()}`;

/**
 * `other` without the vehicles the selected network already shows: one of the same line and mode within
 * `radiusM`, whose delay agrees where both report one (PID and DÚK both list the regional lines between them).
 * Returns `other` itself when none is left out.
 */
export function withoutTwinVehicles(other: VehicleCollection | null, own: VehicleCollection | null | undefined, rule: VehicleTwinRule): VehicleCollection | null {
    if (!other?.features.length || !own?.features.length) return other;
    const ownByLine = new Map<string, VehicleFeature[]>();
    for (const f of own.features) {
        const list = ownByLine.get(lineKey(f));
        if (list) list.push(f);
        else ownByLine.set(lineKey(f), [f]);
    }
    const isTwin = (f: VehicleFeature) => {
        const pos = f.geometry?.coordinates;
        if (!hasPosition(pos)) return false;
        return (ownByLine.get(lineKey(f)) ?? []).some(o => {
            const at = o.geometry?.coordinates;
            if (!hasPosition(at) || calculateDistance(pos, at) > rule.radiusM) return false;
            const a = f.properties.delay, b = o.properties.delay;
            return a == null || b == null || Math.abs(a - b) <= rule.maxDelayGapS;
        });
    };
    const kept = other.features.filter(f => !isTwin(f));
    return kept.length === other.features.length ? other : { ...other, features: kept };
}
