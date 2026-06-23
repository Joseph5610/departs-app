import { Env } from "./_core/types";
import { getCityConfig, CITY_REGISTRY } from "./_core/city-config";
import { GolemioAdapter } from "./_adapters/golemio/GolemioAdapter";
import { GtfsAdapter } from "./_adapters/gtfs/GtfsAdapter";
import type { CityAdapter } from "./_adapters/CityAdapter";

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
        if (!city) continue;

        // Add city home
        xml += `
    <url>
        <loc>${domain}/${citySlug}</loc>
        <changefreq>always</changefreq>
        <priority>0.9</priority>
    </url>`;

        let adapter: CityAdapter;
        if (city.adapter === 'golemio') {
            adapter = new GolemioAdapter(city);
        } else if (city.adapter === 'gtfs') {
            adapter = new GtfsAdapter(city);
        } else {
            continue;
        }

        try {
            const stopsData = await adapter.handleStops(context);
            if (stopsData && stopsData.features) {
                const addedIds = new Set<string>();

                for (const feature of stopsData.features) {
                    const stopId = feature.properties?.stop_id;
                    const isCentroid = feature.properties?.is_centroid;

                    if (stopId && isCentroid) {
                        const cleanId = stopId.replace('centroid-', '');
                        
                        if (!addedIds.has(cleanId)) {
                            addedIds.add(cleanId);
                            xml += `
    <url>
        <loc>${domain}/${citySlug}/stop/${encodeURIComponent(cleanId)}</loc>
        <changefreq>hourly</changefreq>
        <priority>0.8</priority>
    </url>`;
                        }
                    }
                }
            }
        } catch (err) {
            console.error(`Failed to fetch stops for sitemap in ${citySlug}`, err);
        }
    }

    xml += `\n</urlset>`;

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml',
            // Cache sitemap heavily for 24 hours
            'Cache-Control': 'public, max-age=86400, s-maxage=86400'
        }
    });
};
