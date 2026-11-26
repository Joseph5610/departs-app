/** One platform in `<city>/metro_exits.json`; mirrors `MetroPlatformExits` in departs-data's contract. */
export interface MetroPlatformExits {
    /** `[exit name, signposted destination | null, cars for which it is the nearest exit]`; car 1 rides at the front. */
    exits: Array<[string, string | null, number[]]>;
    /** `[exit name, cars]` with the shortest way out avoiding stairs and escalators. */
    stepFree?: [string, number[]];
}

/** `<city>/metro_exits.json` on the static data CDN, by platform stop id. */
export type MetroExitsFile = Record<string, MetroPlatformExits>;
