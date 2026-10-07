import { AppInfotext } from "../../../_core/types";
import { GolemioInfotext } from "../../../_feeds/golemio/schemas/infotexts";


/**
 * Maps raw Golemio infotext records to the internal `AppInfotext` shape,
 * filtering out entries whose validity window does not include the current moment.
 *
 * @param data - Array of raw `GolemioInfotext` objects from the API response.
 * @returns Filtered and mapped array of `AppInfotext` objects valid at call time.
 */
export function mapInfotexts(data: GolemioInfotext[]): AppInfotext[] {

    const now = new Date();
    const nowMs = now.getTime();

    return data
        .filter(item => {
            const validFrom = new Date(item.valid_from).getTime();
            const validTo = item.valid_to ? new Date(item.valid_to).getTime() : null;

            return nowMs >= validFrom && (validTo === null || nowMs <= validTo);
        })
        .map(item => ({
            id: item.id,
            text: item.text,
            textEn: item.text_en,
            priority: item.priority,
            displayType: item.display_type,
            relatedStopIds: item.related_stops.map(stop => stop.id),
            valid_from: new Date(item.valid_from).toISOString(),
            valid_to: item.valid_to ? new Date(item.valid_to).toISOString() : null
        }));
}
