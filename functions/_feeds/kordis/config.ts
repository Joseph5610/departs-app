/** KORDIS (IDS JMK) constants beyond its GTFS-RT feed. */
export const KORDIS_CONFIG = {
    /** Brno open data's daily copy of the iRIS diversions (výluky a odklony) - the RT lockouts plus their dates and the upcoming ones. */
    DIVERSIONS_URL: 'https://gis.brno.cz/ags1/rest/services/Hosted/IDS_JMK_v%C3%BDluky_a_odklony_zdroj_GeoJSON/FeatureServer/0/query'
        + '?where=1%3D1&outFields=diversionid,number_,title,publictext,affectedlines,type_,validfrom,validto,latitude,longitude&returnGeometry=false&f=json',
    /** Upstream publishes once a day; re-read every few hours, served stale while it is down. */
    DIVERSIONS_CACHE_S: 3 * 3600,
    DIVERSIONS_TIMEOUT_MS: 8000,
    /** How long an alerts request waits for an uncached diversions read before answering without it; the read finishes in the background. */
    DIVERSIONS_WAIT_MS: 1500,
    /** Link shown on diversions that are not in the RT feed yet, the same page the RT alerts link to. */
    DIVERSIONS_LINK: 'https://www.idsjmk.cz/index',
    /** A real closure number (`DPMB_V2607-059`, `2509-172`); KORDIS also puts placeholders like `DPMB` there. */
    DIVERSION_NUMBER_PATTERN: /\d{4}-\d{3}/,
    /** GTFS-RT effect the RT feed sends for each iRIS diversion kind: P reduced service, V detour, Z stop moved. */
    DIVERSION_EFFECTS: { P: '2', V: '4', Z: '9' } as Record<string, string | undefined>,
} as const;
