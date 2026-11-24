/**
 * The app's name, hosts and contact: the one file a fork edits to run under its own domain. The app, the
 * Pages Functions and the ride-push Worker all read it, and the build fills it into `index.html` and the
 * `public/` text files as `%SITE_*%` placeholders (vite.config.ts), so keep this file free of imports.
 */
const NAME = 'departs.app';
const URL = 'https://departs.app';

export const SITE = {
    NAME,
    /** The installed PWA's name under its icon. */
    INSTALL_NAME: 'Departs.app',
    INSTALL_SHORT_NAME: 'Departs',
    /** Production origin; the ride-push Worker also reads `/api` from it unless its `API_ORIGIN` var says otherwise. */
    URL,
    TITLE: `${NAME} — MHD Praha, Brno & Prešov LIVE`,
    MCP_URL: `${URL}/mcp`,
    /** Base URL of the departs-data static files (per-city folders). */
    STATIC_DATA_URL: 'https://data.departs.app',
    /** Shown in the legal pages and sent as the VAPID contact, which Apple requires on every push. */
    CONTACT_EMAIL: 'info@departs.app',
    /** Web Push VAPID public key (`npm run vapid`); its private half is the ride-push Worker's `VAPID_PRIVATE_KEY` secret. */
    VAPID_PUBLIC_KEY: 'BOg0cjMBsc0ZcGSg1MglKtCPV2ZCuGl1yQulhaknouJAs0T2kJVPrTn4f7odTc173XYIVP-f4oLTdN_JR0qJL2Q',
    /** Written to the build output root: every bundled package with its full licence text. */
    THIRD_PARTY_LICENSES_FILE: 'THIRD_PARTY_LICENSES.txt',
    /** The data controller named in the privacy policy; its line is left out while unset. */
    OPERATOR: null as string | null,
    /** Date the privacy policy and terms last changed; bump it with any change to their texts. */
    LEGAL_UPDATED: '2026-10-30',
} as const;

/** `%KEY%` placeholders and their values for the build-time template step. */
export const SITE_PLACEHOLDERS: Record<string, string> = {
    SITE_NAME: SITE.NAME,
    SITE_URL: SITE.URL,
    SITE_TITLE: SITE.TITLE,
    SITE_MCP_URL: SITE.MCP_URL,
    SITE_STATIC_DATA_URL: SITE.STATIC_DATA_URL,
};
