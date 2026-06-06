import { AppInfotext } from "../../../../_core/types";
import { formatDate } from "../../../../_core/api-utils";
import { GolemioInfotext } from "./types";

export class InfotextsMapper {
    static map(data: GolemioInfotext[]): AppInfotext[] {
        if (!Array.isArray(data)) {
            console.error("InfotextsMapper: input data is not an array", data);
            return [];
        }

        const now = new Date();
        const nowMs = now.getTime();

        return data
            .filter(item => {
                const validFrom = new Date(item.valid_from).getTime();
                const validTo = item.valid_to ? new Date(item.valid_to).getTime() : null;

                // Filter: now >= valid_from AND (valid_to is null OR now <= valid_to)
                return nowMs >= validFrom && (validTo === null || nowMs <= validTo);
            })
            .map(item => ({
                id: item.id,
                text: item.text,
                textEn: item.text_en,
                priority: item.priority,
                displayType: item.display_type,
                relatedStopIds: item.related_stops.map(stop => stop.id),
                valid_from: formatDate(new Date(item.valid_from)),
                valid_to: item.valid_to ? formatDate(new Date(item.valid_to)) : null
            }));
    }
}
