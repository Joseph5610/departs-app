import {
    DEFAULT_CITY_SLUG,
    FRONTEND_CITIES_CONFIG,
    VIEWER_COUNTRY_BY_LANGUAGE,
    VIEWER_COUNTRY_BY_TIMEZONE,
} from '../config/cities';

let cachedCountry: string | null | undefined;

/**
 * Best-effort country of the viewer: the primary browser language first, then the device time
 * zone. The language goes first because some browsers report Europe/Bratislava as its canonical
 * Europe/Prague. Returns null when neither identifies a supported country.
 */
function getViewerCountry(): string | null {
    if (cachedCountry !== undefined) return cachedCountry;

    const language = typeof navigator !== 'undefined' ? navigator.language : '';
    let country: string | null = VIEWER_COUNTRY_BY_LANGUAGE[language.toLowerCase().split('-')[0]] ?? null;

    if (!country) {
        try {
            country = VIEWER_COUNTRY_BY_TIMEZONE[Intl.DateTimeFormat().resolvedOptions().timeZone] ?? null;
        } catch {
            country = null;
        }
    }

    cachedCountry = country;
    return country;
}

/** The first city of the viewer's country, or the global default. Used only before any city is persisted. */
export function getDefaultCitySlug(): string {
    const country = getViewerCountry();
    if (country) {
        for (const city of Object.values(FRONTEND_CITIES_CONFIG)) {
            if (city.country === country) return city.slug;
        }
    }
    return DEFAULT_CITY_SLUG;
}

/** Orders cities with the viewer's country first, keeping registry order within each country. */
export function groupCitiesByCountry<T extends { country: string }>(cities: T[]): Array<{ country: string; cities: T[] }> {
    const groups = new Map<string, T[]>();
    for (const city of cities) {
        const bucket = groups.get(city.country);
        if (bucket) bucket.push(city);
        else groups.set(city.country, [city]);
    }

    const viewerCountry = getViewerCountry();
    const ordered = Array.from(groups, ([country, list]) => ({ country, cities: list }));
    if (viewerCountry) {
        ordered.sort((a, b) => Number(b.country === viewerCountry) - Number(a.country === viewerCountry));
    }
    return ordered;
}
