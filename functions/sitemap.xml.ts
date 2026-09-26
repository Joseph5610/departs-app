import { Env } from "./_core/types";
import { getCityConfig, CITY_REGISTRY } from "./_cities";
import { CACHE_TTL } from "./_core/config";
import { getSitemapStopIds } from "./_feeds/stop-search";

export const onRequest: PagesFunction<Env> = async (context) => {
    const domain = new URL(context.request.url).origin;
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    // Add homepage
    xml += `
    <url>
        <loc>${domain}/</loc>
        <changefreq>always</changefreq>
        <priority>1.0</priority>
    </url>`;

    // Generate sitemap for each city
    for (const citySlug of Object.keys(CITY_REGISTRY)) {
        const city = getCityConfig(citySlug);
        // Hidden regions stay out of search engines until they launch.
        if (!city || city.isHidden) continue;

        // Add city home
        xml += `
    <url>
        <loc>${domain}/${citySlug}</loc>
        <changefreq>always</changefreq>
        <priority>0.9</priority>
    </url>`;

        try {
            // One native replace over departs-data's prebuilt id list: per-stop work here would not fit a request's CPU budget.
            const ids = await getSitemapStopIds(city);
            xml += `\n${ids.trim().replace(/^(.+)$/gm, `    <url>
        <loc>${domain}/${citySlug}/stop/$1</loc>
        <changefreq>hourly</changefreq>
        <priority>0.8</priority>
    </url>`)}`;
        } catch (err) {
            console.error(`Failed to fetch stops for sitemap in ${citySlug}`, err);
        }
    }

    xml += `\n</urlset>`;

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': `public, max-age=${CACHE_TTL.SITEMAP}, s-maxage=${CACHE_TTL.SITEMAP}, stale-while-revalidate=${CACHE_TTL.SITEMAP_STALE_WHILE_REVALIDATE}, stale-if-error=${CACHE_TTL.SITEMAP_STALE_IF_ERROR}`
        }
    });
};
