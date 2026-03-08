import { Env, GolemioInfotext, AppInfotext } from "../_utils/types";
import { CACHE_TTL, ERROR_MESSAGES, createErrorResponse, createSuccessResponse, golemioFetch } from "../_utils/api-utils";

/**
 * Formats a date into D. M. YYYY HH:mm in Europe/Prague timezone.
 */
function formatPragueDate(date: Date): string {
    const d = new Intl.DateTimeFormat('cs-CZ', {
        timeZone: 'Europe/Prague',
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
    }).formatToParts(date);

    const get = (type: string) => d.find(p => p.type === type)?.value;
    return `${get('day')}. ${get('month')}. ${get('year')} ${get('hour')?.padStart(2, '0')}:${get('minute')?.padStart(2, '0')}`;
}

/**
 * Retrieves the transit infotexts from Golemio API.
 */
export const onRequest: PagesFunction<Env> = async (context) => {
    const { env } = context;

    try {
        const response = await golemioFetch("/v3/pid/infotexts", env, {
            cacheTtl: CACHE_TTL.INFOTEXTS,
            searchParams: {
                includeFuture: "true"
            }
        });

        if (!response.ok) {
            return createErrorResponse(ERROR_MESSAGES.UPSTREAM_ERROR(response.status), response.status);
        }

        const data: GolemioInfotext[] = await response.json();
        const now = new Date();
        const nowMs = now.getTime();

        const filteredAndNormalized: AppInfotext[] = data
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
                date_from: formatPragueDate(new Date(item.valid_from)),
                date_to: item.valid_to ? formatPragueDate(new Date(item.valid_to)) : null
            }));

        return createSuccessResponse(filteredAndNormalized, CACHE_TTL.INFOTEXTS);
    } catch (error) {
        console.error("Infotexts API Error:", error);
        return createErrorResponse(ERROR_MESSAGES.GENERIC_INTERNAL);
    }
};
