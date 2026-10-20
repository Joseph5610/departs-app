/** The ids one requested `stopId` value names: a single stop, or a comma-joined list read as one stop. */
export const stopIdParts = (stopId: string): string[] => stopId.split(',').map(id => id.trim()).filter(Boolean);

/** Separates a requested value's station from its platforms: `U1146:U1146Z22,U1146Z23`. */
const STATION_SEPARATOR = ':';

/**
 * A requested value as the station it names and the stops to read. `<station>:<platform>,…` names the station
 * the platforms belong to, so no lookup is needed; `<station>:` alone is the whole station. A value without the
 * separator names stops on their own (a station, or a platform whose station must be looked up).
 */
export function parseStopRequest(value: string): { station: string | null; parts: string[] } {
    const at = value.indexOf(STATION_SEPARATOR);
    if (at < 0) return { station: null, parts: stopIdParts(value) };
    const station = value.slice(0, at).trim();
    const parts = stopIdParts(value.slice(at + 1));
    return { station, parts: parts.length ? parts : [station] };
}

/** The stops a requested value names, with or without its station. */
export const requestParts = (value: string): string[] => parseStopRequest(value).parts;
