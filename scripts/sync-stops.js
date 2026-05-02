import fs from 'fs';
import path from 'path';

const SOURCE_URL = "https://data.pid.cz/stops/json/stops.json";
const OUTPUT_DIR = "functions/_data";
const OUTPUT_FILE = path.join(OUTPUT_DIR, "stops-enrichment.json");

async function syncStops() {
    console.log(`Fetching PID stops from ${SOURCE_URL}...`);

    try {
        const res = await fetch(SOURCE_URL, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36"
            }
        });

        if (!res.ok) {
            throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        console.log(`Received ${data.stopGroups?.length || 0} stop groups.`);

        const enrichmentMap = {};

        data.stopGroups?.forEach(g => {
            g.stops?.forEach(s => {
                s.gtfsIds?.forEach(id => {
                    enrichmentMap[id] = {
                        l: s.lines?.map(l => ({ n: l.name, t: l.type, e: l.exitOnly ? 1 : 0 })) || [],
                        n: g.fullName || g.name
                    };
                });
            });
        });

        const count = Object.keys(enrichmentMap).length;
        console.log(`Processed ${count} GTFS IDs into enrichment map.`);

        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(enrichmentMap));
        console.log(`Saved enrichment data to ${OUTPUT_FILE} (${(fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(2)} MB)`);

    } catch (error) {
        console.error("Sync failed:", error);
        process.exit(1);
    }
}

syncStops();
