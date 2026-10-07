import { SHARED_GROUND } from '@/config/constants';
import type { NetworkCoverage } from '@/types';

interface CityExtent {
    slug: string;
    bounds: [number, number, number, number];
}

/** `[west, south, east, north]` */
export type Box = [number, number, number, number];

/** Whether `box` overlaps a city's `bounds`, which frame the city itself rather than its whole network. */
export const overlapsBounds = ({ bounds: [minLng, minLat, maxLng, maxLat] }: CityExtent, [west, south, east, north]: Box): boolean =>
    west <= maxLng && east >= minLng && south <= maxLat && north >= minLat;

/** How many stops a network has in `box`, from its coverage grid. */
export const stopsInBox = ({ cell, cells }: NetworkCoverage, [west, south, east, north]: Box): number => {
    let total = 0;
    for (let x = Math.floor(west / cell); x <= Math.floor(east / cell); x++) {
        for (let y = Math.floor(south / cell); y <= Math.floor(north / cell); y++) {
            total += cells[`${x}|${y}`] ?? 0;
        }
    }
    return total;
};

/**
 * The network to select for a view: `preferredSlug` while it keeps a fair share of the stops in
 * view, else the network with the most. A network whose coverage has not loaded is not picked, and
 * keeps the selection if it holds it. Undefined where no network has stops.
 */
export const pickCity = <T extends CityExtent>(cities: T[], coverages: ReadonlyMap<string, NetworkCoverage>, box: Box | ((coverage: NetworkCoverage) => Box), preferredSlug?: string): T | undefined => {
    let best: T | undefined;
    let bestCount = 0;
    let preferred: T | undefined;
    let preferredCount = 0;
    for (const city of cities) {
        const coverage = coverages.get(city.slug);
        if (!coverage) {
            if (city.slug === preferredSlug) preferred = city;
            continue;
        }
        const count = stopsInBox(coverage, typeof box === 'function' ? box(coverage) : box);
        if (city.slug === preferredSlug) { preferred = city; preferredCount = count; }
        if (count > bestCount) { best = city; bestCount = count; }
    }
    if (!preferred) return best;
    // Unknown coverage keeps the selection until it loads.
    if (!coverages.has(preferred.slug)) return preferred;
    return preferredCount > 0 && preferredCount >= bestCount * SHARED_GROUND.KEEP_SELECTED_SHARE ? preferred : best;
};

/** The network `[lng, lat]` belongs to, if any; `preferredSlug` wherever it runs a fair share of the stops. */
export const findCityAt = <T extends CityExtent>(cities: T[], coverages: ReadonlyMap<string, NetworkCoverage>, [lng, lat]: [number, number], preferredSlug?: string): T | undefined =>
    pickCity(cities, coverages, ({ cell }) => [lng - cell, lat - cell, lng + cell, lat + cell], preferredSlug);

/** The networks other than `selectedSlug` with stops inside `south,west,north,east` bounds. */
export const networksInView = (cities: CityExtent[], coverages: ReadonlyMap<string, NetworkCoverage>, selectedSlug: string, bounds: string): string[] => {
    const [south, west, north, east] = bounds.split(',').map(Number);
    return cities
        .filter(city => {
            const coverage = coverages.get(city.slug);
            return city.slug !== selectedSlug && !!coverage && stopsInBox(coverage, [west, south, east, north]) > 0;
        })
        .map(city => city.slug);
};

/** Whether a city is offered for picking: hidden ones only on a device that unlocked them with `?beta=<slug>`. */
export const isCityVisible = (city: { slug: string; isHidden?: boolean }, unlockedCities: readonly string[]): boolean =>
    !city.isHidden || unlockedCities.includes(city.slug);

/** The city whose centre lies in `box` closest to the view's centre, when no network has stops in view. */
export const nearestCityCentreIn = <T extends { center?: [number, number] }>(cities: T[], [west, south, east, north]: Box, [lng0, lat0]: [number, number]): T | undefined => {
    let nearest: T | undefined;
    let minDistance = Infinity;
    for (const city of cities) {
        if (!city.center) continue;
        const [lng, lat] = city.center;
        if (lng < west || lng > east || lat < south || lat > north) continue;
        const dist = (lng - lng0) ** 2 + (lat - lat0) ** 2;
        if (dist < minDistance) {
            minDistance = dist;
            nearest = city;
        }
    }
    return nearest;
};
