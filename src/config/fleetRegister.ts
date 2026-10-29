import type { CitySlug } from '@shared/cities';

/** seznam-autobusu.cz, the fan-run Czech fleet register a vehicle number links to. */
export const FLEET_REGISTER = {
    SEARCH_URL: 'https://seznam-autobusu.cz/seznam',
    /**
     * By city, the operator a vehicle detail names mapped to the carrier name the site searches by.
     * Only names checked by hand on the site: a fleet number alone lists every carrier's vehicle with it.
     */
    CARRIERS: {
        prague: { 'DP PRAHA': 'Dopravní podnik hl. m. Prahy' },
        brno: { DPMB: 'DPMB' },
        presov: { DPMP: 'DP mesta Prešov' },
    } satisfies Partial<Record<CitySlug, Record<string, string>>> as Record<string, Record<string, string> | undefined>,
    /**
     * By city, the site's carrier country (`operatorCountryId`) for vehicles of any other carrier: their
     * operator is unreliable (subcontracts), so the link lists that country's vehicles with the number.
     */
    COUNTRY_IDS: {
        prague: 1,
    } satisfies Partial<Record<CitySlug, number>> as Record<string, number | undefined>,
};
