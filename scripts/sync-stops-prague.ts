import * as fs from 'fs';
import * as path from 'path';

const SOURCE_URL = "https://data.pid.cz/stops/json/stops.json";
const OUTPUT_DIR = "functions/_data/cities/prague";
const OUTPUT_FILE = path.join(OUTPUT_DIR, "stops-enrichment.json");

interface PIDLine {
    name: string;
    type: string;
    direction?: string;
    exitOnly?: boolean;
}

interface PIDStop {
    gtfsIds: string[];
    lines: PIDLine[];
}

interface StopGroup {
    name: string;
    fullName?: string;
    stops: PIDStop[];
}

interface PIDData {
    stopGroups: StopGroup[];
}

interface EnrichmentLine {
    n: string;
    t: string;
    e: number;
}

interface EnrichmentData {
    l: EnrichmentLine[];
    n: string;
}

async function syncStops() {
    console.log(`[SYNC] Fetching PID stops from ${SOURCE_URL}...`);

    try {
        const res = await fetch(SOURCE_URL, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36"
            }
        });

        if (!res.ok) {
            throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
        }

        const data = await res.json() as PIDData;
        console.log(`[SYNC] Received ${data.stopGroups?.length || 0} stop groups.`);

        const enrichmentMap: Record<string, EnrichmentData> = {};

        data.stopGroups?.forEach(g => {
            g.stops?.forEach(s => {
                s.gtfsIds?.forEach(id => {
                    const lines: EnrichmentLine[] = s.lines?.map(l => {
                        return { n: l.name, t: l.type, e: l.exitOnly ? 1 : 0 };
                    }) || [];

                    enrichmentMap[id] = {
                        l: lines,
                        n: g.fullName || g.name
                    };
                });
            });
        });

        const count = Object.keys(enrichmentMap).length;
        console.log(`[SYNC] Processed ${count} GTFS IDs.`);

        if (count < 1000) {
            throw new Error(`Suspiciously low number of entries (${count}). Aborting save to protect existing data.`);
        }

        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(enrichmentMap));
        console.log(`[SYNC] SUCCESS: Saved enrichment data to ${OUTPUT_FILE}`);

    } catch (error) {
        console.error("[SYNC] FAILED:", error);
        process.exit(1);
    }
}

syncStops();
