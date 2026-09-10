import {
    DEFAULT_CITY_SLUG,
    FRONTEND_CITIES_CONFIG,
    VIEWER_COUNTRY_BY_LANGUAGE,
    VIEWER_COUNTRY_BY_TIMEZONE,
} from '../config/cities';

let cachedCountry: string | null | undefined;

/**
 * Best-effort country of the viewer, from the device time zone and then the browser language.
 * Returns null when neither identifies a supported country.
 */
export function getViewerCountry(): string | null {
    if (cachedCountry !== undefined) return cachedCountry;

    let country: string | null;
    try {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        country = VIEWER_COUNTRY_BY_TIMEZONE[timeZone] ?? null;
    } catch {
        country = null;
    }

    if (!country && typeof navigator !== 'undefined') {
        for (const lang of navigator.languages ?? [navigator.language]) {
            const match = VIEWER_COUNTRY_BY_LANGUAGE[lang.toLowerCase().split('-')[0]];
            if (match) {
                country = match;
                break;
            }
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
