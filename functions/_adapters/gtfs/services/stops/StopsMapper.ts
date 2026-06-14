import type { AppStopFeature } from "../../../../_core/types";

export class StopsMapper {
    /**
     * Transforms raw GTFS stop features into a unified structural representation.
     * 
     * The GTFS spec often separates physical platforms (nodes) from their logical 
     * structural groups (parent stations). This method runs a two-phase grouping algorithm:
     * 
     * 1. **Phase 1 (Structural)**: Identifies all features with `location_type === 1` as Parent Stations.
     * 2. **Phase 2 (Logical)**: Iterates over regular stops (`location_type === 0`) and merges their transit lines
     *    and metadata up into their respective Parent Station. 
     * 
     * Finally, it assigns `is_centroid = true` to parents to ensure the frontend map renders 
     * a single consolidated marker per station instead of 10 overlapping platform markers.
     * 
     * @param rawFeatures The raw flattened array of stop features parsed from stops.json.
     * @returns A mapped array of stops with merged parent topologies and centroid identities.
     */
    static mapStops(rawFeatures: AppStopFeature[]): AppStopFeature[] {
        // Phase 1: Structural - Identify parent stations
        const parents = new Map<string, AppStopFeature>();
        const nodes: AppStopFeature[] = [];

        for (const f of rawFeatures) {
            if (f.properties.location_type === 1) {
                parents.set(f.properties.stop_id, f);
            } else {
                nodes.push(f);
            }
        }

        // Phase 2: Logical - Merge nodes into parents
        for (const n of nodes) {
            const pId = n.properties.parent_station;
            if (pId && parents.has(pId)) {
                const p = parents.get(pId)!;
                
                const allLines = new Map((p.properties.lines || []).map((l) => [l.name, l]));
                for (const l of n.properties.lines || []) {
                    allLines.set(l.name, l);
                }
                p.properties.lines = Array.from(allLines.values());
                
                if (n.properties.lines?.some((l) => String(l.type) === '2' || l.type === 'train')) {
                    p.properties.is_train = 1;
                }

                if (!p.properties.all_ids) p.properties.all_ids = [];
                p.properties.all_ids.push(n.properties.stop_id);
            }
        }

        const finalFeatures: AppStopFeature[] = [];
        
        for (const p of parents.values()) {
            // 1. Create a clone for the centroid label
            const centroid = JSON.parse(JSON.stringify(p));
            centroid.properties.is_centroid = true;
            // No prefixing! Centroids and parents share the same ID so URLs stay clean.
            finalFeatures.push(centroid);

            // 2. Keep the original parent for actual map interactions and routing
            p.properties.is_centroid = false;
            finalFeatures.push(p);
        }

        for (const n of nodes) {
            n.properties.is_centroid = false;
            finalFeatures.push(n);
        }

        return finalFeatures;
    }
}
