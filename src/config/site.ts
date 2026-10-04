/**
 * The app's name and hosts. Also filled into `index.html` and the `public/` text files at build as
 * `%SITE_*%` placeholders (vite.config.ts), so keep this file free of imports.
 */
const NAME = 'departs.app';
const URL = 'https://departs.app';

export const SITE = {
    NAME,
    /** The installed PWA's name under its icon. */
    INSTALL_NAME: 'Departs.app',
    INSTALL_SHORT_NAME: 'Departs',
    URL,
    TITLE: `${NAME} — MHD Praha, Brno & Prešov LIVE`,
    MCP_URL: `${URL}/mcp`,
    STATIC_DATA_URL: 'https://data.departs.app',
} as const;

/** `%KEY%` placeholders and their values for the build-time template step. */
export const SITE_PLACEHOLDERS: Record<string, string> = {
    SITE_NAME: SITE.NAME,
    SITE_URL: SITE.URL,
    SITE_TITLE: SITE.TITLE,
    SITE_MCP_URL: SITE.MCP_URL,
    SITE_STATIC_DATA_URL: SITE.STATIC_DATA_URL,
};
