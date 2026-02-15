import { GOLEMIO_API, CACHE_CONFIG, LIMITS } from '../_utils/config';
import { calculateCentroid, METRO_STATIONS } from '../_utils/transit-utils';

interface Env {
    GOLEMIO_API_KEY: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
    const { env } = context;

    const fetchAllStops = async () => {
        let allFeatures: any[] = [];
        let offset = 0;
        const limit = LIMITS.STOPS_FETCH_LIMIT;

        while (offset < LIMITS.STOPS_MAX_OFFSET) {
            const url = new URL(`${GOLEMIO_API.BASE_URL}/v2${GOLEMIO_API.ENDPOINTS.STOPS}`);
            url.searchParams.set("limit", limit.toString());
            url.searchParams.set("offset", offset.toString());

            const res = await fetch(url.toString(), {
                headers: { "X-Access-Token": env.GOLEMIO_API_KEY, "Content-Type": "application/json" },
                cf: { cacheTtl: CACHE_CONFIG.STOPS_TTL, cacheEverything: true }
            } as any);

            if (!res.ok) break;
            const data = await res.json() as { features: any[] };
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

        // 1. Identify parents (Stations - Type 1) and collect their children (Platforms - Type 0)
        all.forEach(f => {
            const p = f.properties;
            const type = Number(p.location_type);
            if (type === 1) stationAnchors.set(p.stop_id, f);
            if (p.parent_station && type !== 2) { // Ignore entrances (Type 2)
                if (!stationChildren.has(p.parent_station)) stationChildren.set(p.parent_station, []);
                stationChildren.get(p.parent_station).push(p.stop_id);
            }
        });

        const groups: Record<string, any> = {};

        // 2. Group stops by type and name to deduplicate visually
        all.forEach(f => {
            const p = f.properties;
            const type = Number(p.location_type);
            const stopId = p.stop_id;

            if (type === 1) { // METRO STATION
                const children = stationChildren.get(stopId) || [];
                groups[`metro_station_${stopId}`] = {
                    ...f,
                    properties: {
                        ...p,
                        location_type: 1,
                        stop_id: children.length > 0 ? children.join(',') : stopId,
                        metro_lines: METRO_STATIONS[p.stop_name] || []
                    }
                };
            } else if (type === 2) { // ENTRANCE
                groups[`entrance_${stopId}`] = { ...f, properties: { ...p, location_type: 2 } };
            } else if (type === 0 || isNaN(type)) { // PLATFORM / STOP POINT
                if (p.parent_station && stationAnchors.has(p.parent_station)) return;
                if (!p.stop_name || (!p.zone_id && !p.parent_station)) return;

                const key = `stop_${p.stop_name.toLowerCase()}_${p.platform_code || ''}`;
                if (!groups[key]) {
                    groups[key] = { ...f, properties: { ...p, location_type: 0, all_ids: [stopId] } };
                } else {
                    groups[key].properties.all_ids.push(stopId);
                }
            }
        });

        const features: any[] = [];

        // 3. Generate final features from groups
        Object.values(groups).forEach((f: any) => {
            features.push({
                type: "Feature",
                geometry: f.geometry,
                properties: {
                    ...f.properties,
                    stop_id: f.properties.all_ids ? f.properties.all_ids.join(',') : f.properties.stop_id
                }
            });
        });

        // 4. Calculate Centroids for map labeling
        // This ensures that stop labels appear at a balanced center point even for
        // spread-out stops with multiple platforms.
        const nameGroups: Record<string, any[]> = {};
        all.forEach(f => {
            if (f.properties.location_type === 2 || !f.properties.stop_name) return;
            if (!nameGroups[f.properties.stop_name]) nameGroups[f.properties.stop_name] = [];
            nameGroups[f.properties.stop_name].push(f);
        });

        Object.values(nameGroups).forEach((groupFeatures) => {
            const station = groupFeatures.find(f => f.properties.location_type === 1);
            const anchorFeature = station || groupFeatures[0];
            const coords = station ? station.geometry.coordinates : calculateCentroid(groupFeatures);

            features.push({
                type: "Feature",
                geometry: { type: "Point", coordinates: coords },
                properties: {
                    ...anchorFeature.properties,
                    is_centroid: true,
                    stop_id: `centroid-${anchorFeature.properties.stop_id}`
                }
            });
        });

        return new Response(JSON.stringify({ type: "FeatureCollection", features }), {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": `public, max-age=${CACHE_CONFIG.STOPS_TTL}, s-maxage=${CACHE_CONFIG.STOPS_TTL}`,
            }
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return new Response(`Error: ${message}`, { status: 500 });
    }
};
