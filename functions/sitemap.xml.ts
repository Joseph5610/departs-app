import { Env } from "./_core/types";
import { getCityConfig } from "./_core/city-config";
import { GolemioAdapter } from "./_adapters/golemio/GolemioAdapter";

export const onRequest: PagesFunction<Env> = async (context) => {
    // Generate sitemap for prague
    const city = getCityConfig('prague');
    if (!city) {
        return new Response('City not found', { status: 404 });
    }
    const adapter = new GolemioAdapter(city);

    // Fetch stops using the adapter
    const stopsData = await adapter.handleStops(context);
    
    const domain = new URL(context.request.url).origin;
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    // Add homepage
    xml += `
    <url>
        <loc>${domain}/</loc>
        <changefreq>always</changefreq>
        <priority>1.0</priority>
    </url>`;

    // Add stops
    if (stopsData && stopsData.features) {
        const addedIds = new Set<string>();

        for (const feature of stopsData.features) {
            const stopId = feature.properties?.stop_id;
            const isCentroid = feature.properties?.is_centroid;

            if (stopId && isCentroid) {
                // Remove 'centroid-' prefix for the clean ID used in URLs
                const cleanId = stopId.replace('centroid-', '');
                
                if (!addedIds.has(cleanId)) {
                    addedIds.add(cleanId);
                    xml += `
    <url>
        <loc>${domain}/stop/${encodeURIComponent(cleanId)}</loc>
        <changefreq>hourly</changefreq>
        <priority>0.8</priority>
    </url>`;
                }
            }
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
