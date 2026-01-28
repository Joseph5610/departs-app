interface Env {
    GOLEMIO_API_KEY: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
    const { env } = context;

    const fetchPage = async (offset: number) => {
        const url = new URL("https://api.golemio.cz/v2/gtfs/stops");
        url.searchParams.set("limit", "10000");
        url.searchParams.set("offset", offset.toString());
        const res = await fetch(url.toString(), {
            headers: { "X-Access-Token": env.GOLEMIO_API_KEY, "Content-Type": "application/json" },
            cf: { cacheTtl: 3600, cacheEverything: true }
        } as any);
        return res.ok ? res.json() : null;
    };

    try {
        const [p1, p2] = await Promise.all([fetchPage(0), fetchPage(10000)]);
        if (!p1) return new Response("Golemio error", { status: 502 });
        const all = [...(p1.features || []), ...(p2?.features || [])];

        // 1. Map Metro Stations (Type 1)
        const stationAnchors = new Map();
        const stationChildren = new Map();

        for (const f of all) {
            if (f.properties.location_type === 1) {
                stationAnchors.set(f.properties.stop_id, f);
            }
        }

        // 2. Map children to parents
        for (const f of all) {
            const p = f.properties;
            if (p.location_type === 0 && p.parent_station && stationAnchors.has(p.parent_station)) {
                if (!stationChildren.has(p.parent_station)) stationChildren.set(p.parent_station, []);
                stationChildren.get(p.parent_station).push(p.stop_id);
            }
        }

        const groups = {};
        const handledChildren = new Set();

        for (const f of all) {
            const p = f.properties;
            if (p.zone_id === null) continue;

            const type = p.location_type;
            const stopId = p.stop_id;

            // METRO STATION (Anchor)
            if (type === 1) {
                const children = stationChildren.get(stopId) || [];
                const key = `metro_station_${stopId}`;
                groups[key] = {
                    ...f,
                    properties: {
                        ...p,
                        stop_id: children.length > 0 ? children.join(',') : stopId
                    }
                };
                continue;
            }

            // ENTRANCE (Type 2)
            if (type === 2) {
                groups[`entrance_${stopId}`] = f;
                continue;
            }

            // PLATFORM / STOP POINT (Type 0)
            if (type === 0) {
                // If it's a metro platform handled by an anchor, skip it
                if (p.parent_station && stationAnchors.has(p.parent_station)) continue;

                // Regular Bus/Tram stop (Grouping by name and platform code)
                const key = `stop_${p.stop_name.toLowerCase()}_${p.platform_code || ''}_${p.zone_id}`;
                if (!groups[key]) {
                    groups[key] = { ...f, properties: { ...p, all_ids: [stopId] } };
                } else {
                    groups[key].properties.all_ids.push(stopId);
                }
            }
        }

        const features = Object.values(groups).map((f: any) => {
            const finalId = f.properties.all_ids ? f.properties.all_ids.join(',') : f.properties.stop_id;
            return {
                type: "Feature",
                geometry: f.geometry,
                properties: { ...f.properties, stop_id: finalId }
            };
        });

        return new Response(JSON.stringify({ type: "FeatureCollection", features }), {
            headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" }
        });
    } catch (err) { return new Response("Error", { status: 500 }); }
};
