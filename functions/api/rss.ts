
export const onRequest: PagesFunction = async (context) => {
    const { searchParams } = new URL(context.request.url);
    const type = searchParams.get('type');

    const FEEDS = {
        incidents: 'https://pid.cz/feed/rss-mimoradnosti/',
        exclusions: 'https://pid.cz/feed/rss-vyluky/'
    };

    const targetUrl = FEEDS[type as keyof typeof FEEDS];

    if (!targetUrl) {
        return new Response('Missing or invalid type parameter', { status: 400 });
    }

    try {
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; departs-app/0.1; +https://departs.app)',
                'Accept': 'application/rss+xml, application/xml, text/xml'
            }
        });

        if (!response.ok) {
            return new Response(`Upstream error: ${response.status} ${response.statusText}`, { status: response.status });
        }

        const data = await response.text();

        return new Response(data, {
            headers: {
                'Content-Type': 'application/rss+xml; charset=UTF-8',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': type === 'incidents' ? 'public, max-age=300' : 'public, max-age=3600'
            }
        });
    } catch (error) {
        return new Response(`Error fetching RSS: ${error instanceof Error ? error.message : String(error)}`, { status: 500 });
    }
};
