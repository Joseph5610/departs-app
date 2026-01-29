interface Env {
    GOLEMIO_API_KEY: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
    const { env } = context;

    const fetchAllStops = async () => {
        let allFeatures: any[] = [];
        let offset = 0;
        const limit = 10000;

        while (offset < 40000) {
            const url = new URL("https://api.golemio.cz/v2/gtfs/stops");
            url.searchParams.set("limit", limit.toString());
            url.searchParams.set("offset", offset.toString());

            const res = await fetch(url.toString(), {
                headers: { "X-Access-Token": env.GOLEMIO_API_KEY, "Content-Type": "application/json" },
                cf: { cacheTtl: 3600, cacheEverything: true }
            } as any);

            if (!res.ok) break;
            const data = await res.json();
            if (!data.features || data.features.length === 0) break;

            allFeatures = [...allFeatures, ...data.features];
            if (data.features.length < limit) break;
            offset += limit;
        }
        return allFeatures;
    };

    try {
        const all = await fetchAllStops();
        if (all.length === 0) return new Response("Golemio error or no data", { status: 502 });

        const stationAnchors = new Map();
        const stationChildren = new Map();

        // 1. Map Metro Stations and identify parents
        for (const f of all) {
            const p = f.properties;
            const type = Number(p.location_type);
            if (type === 1) {
                stationAnchors.set(p.stop_id, f);
            }
            if (p.parent_station) {
                // Only add platforms/stops to children, ignore entrances (type 2)
                // Otherwise departure API URL gets too long and fails (400)
                if (type !== 2) {
                    if (!stationChildren.has(p.parent_station)) stationChildren.set(p.parent_station, []);
                    stationChildren.get(p.parent_station).push(p.stop_id);
                }
            }
        }

        const groups: Record<string, any> = {};

        for (const f of all) {
            const p = f.properties;
            const type = Number(p.location_type);
            const stopId = p.stop_id;

            // Hardcoded Metro Station -> Lines mapping
            // used to colorize stations on the map
            const METRO_STATIONS: Record<string, string[]> = {
                // Line A (Green)
                "Nemocnice Motol": ["A"], "Petřiny": ["A"], "Nádraží Veleslavín": ["A"], "Bořislavka": ["A"],
                "Dejvická": ["A"], "Hradčanská": ["A"], "Malostranská": ["A"], "Staroměstská": ["A"],
                "Náměstí Míru": ["A"], "Jiřího z Poděbrad": ["A"], "Flora": ["A"], "Želivského": ["A"],
                "Strašnická": ["A"], "Skalka": ["A"], "Depo Hostivař": ["A"],

                // Line B (Yellow)
                "Zličín": ["B"], "Stodůlky": ["B"], "Luka": ["B"], "Lužiny": ["B"], "Hůrka": ["B"],
                "Nové Butovice": ["B"], "Jinonice": ["B"], "Radlická": ["B"], "Smíchovské nádraží": ["B"],
                "Anděl": ["B"], "Karlovo náměstí": ["B"], "Národní třída": ["B"], "Náměstí Republiky": ["B"],
                "Křižíkova": ["B"], "Invalidovna": ["B"], "Palmovka": ["B"], "Českomoravská": ["B"],
                "Vysočanská": ["B"], "Kolbenova": ["B"], "Hloubětín": ["B"], "Rajská zahrada": ["B"], "Černý Most": ["B"],

                // Line C (Red)
                "Letňany": ["C"], "Prosek": ["C"], "Střížkov": ["C"], "Ládví": ["C"], "Kobylisy": ["C"],
                "Nádraží Holešovice": ["C"], "Vltavská": ["C"], "Hlavní nádraží": ["C"], "I. P. Pavlova": ["C"],
                "Vyšehrad": ["C"], "Pražského povstání": ["C"], "Pankrác": ["C"], "Budějovická": ["C"],
                "Kačerov": ["C"], "Roztyly": ["C"], "Chodov": ["C"], "Opatov": ["C"], "Háje": ["C"],

                // Transfers
                "Můstek": ["A", "B"],
                "Muzeum": ["A", "C"],
                "Florenc": ["B", "C"]
            };

            // METRO STATION (Type 1)
            if (type === 1) {
                const children = stationChildren.get(stopId) || [];
                const lines = METRO_STATIONS[p.stop_name] || [];

                const key = `metro_station_${stopId}`;
                groups[key] = {
                    ...f,
                    properties: {
                        ...p,
                        location_type: 1,
                        stop_id: children.length > 0 ? children.join(',') : stopId,
                        metro_lines: lines
                    }
                };
                continue;
            }

            // ENTRANCE (Type 2) - Static, non-clickable in UI
            if (type === 2) {
                groups[`entrance_${stopId}`] = {
                    ...f,
                    properties: { ...p, location_type: 2 }
                };
                continue;
            }

            // PLATFORM / STOP POINT (Type 0)
            if (type === 0 || isNaN(type)) {
                // If it belongs to a metro station or is an entrance already handled, skip
                if (p.parent_station && stationAnchors.has(p.parent_station)) continue;

                if (!p.stop_name) continue;

                // SAFE FILTER: drop technical stops ONLY if they are orphans (no parent) AND have no zone.
                // Keeps metro platforms (which have parent) even if they lack zone_id.
                if (!p.zone_id && !p.parent_station) continue;

                // MERGE STRATEGY: grouping by Name + Platform.
                // We intentionally ignore zone_id here. If a stop exists in multiple zones (e.g. B and 1),
                // we want them merged into one visual dot. The `all_ids` array will collect IDs from all zones.
                const key = `stop_${p.stop_name.toLowerCase()}_${p.platform_code || ''}`;
                if (!groups[key]) {
                    groups[key] = {
                        ...f,
                        properties: { ...p, location_type: 0, all_ids: [stopId] }
                    };
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
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store, max-age=0"
            }
        });
    } catch (err) {
        return new Response("Error: " + (err instanceof Error ? err.message : "unknown"), { status: 500 });
    }
};
