/** Terms upstream data is published under. */
export type DataLicenseId = 'ccBy4' | 'odbl1' | 'czOpenData' | 'permission' | 'notStated';

/**
 * One upstream data source, credited as its licence asks: who made it, what it is, where it is
 * published and under which terms. Shown in Settings together with the note that departs.app
 * changes the data (CC BY 4.0 §3(a)).
 */
export interface DataAttribution {
    /** Who the source's licence says to credit. */
    creator: string;
    /** The dataset or service, as its publisher names it. */
    title: string;
    url: string;
    license: DataLicenseId;
}

/** Where each licence's text lives; labels are translated under `settings.attributions.licenses`. */
export const DATA_LICENSE_URLS: Record<DataLicenseId, string | null> = {
    ccBy4: 'https://creativecommons.org/licenses/by/4.0/',
    odbl1: 'https://opendatacommons.org/licenses/odbl/1-0/',
    // Czech national open data terms: no copyrighted work and no protected database.
    czOpenData: 'https://data.gov.cz/podmínky-užití/neobsahuje-autorská-díla/',
    permission: null,
    notStated: null,
};

/** Sources behind every city: the base map and place search. */
export const SHARED_DATA_ATTRIBUTIONS: DataAttribution[] = [
    { creator: 'OpenStreetMap contributors', title: 'Map data (CARTO basemaps) and place search (Photon by komoot)', url: 'https://www.openstreetmap.org/copyright', license: 'odbl1' },
];

/**
 * Where departs.app documents its processed static data: sources, changes and, per city, the
 * licence it republishes under (`InitialCityConfig.processedDataLicense`, CC BY 4.0 by default;
 * a city built from an ODbL source stays ODbL, since ODbL's share-alike clause forbids relicensing
 * a derivative database).
 */
export const PROCESSED_DATA_URL = 'https://github.com/Joseph5610/departs-data#-license';
