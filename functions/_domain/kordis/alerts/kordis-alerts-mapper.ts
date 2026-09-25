import * as GtfsRt from '../../../_core/gtfsRtTypes';
import { createGtfsAlertsMapper, defaultParseIsDetour, type AlertsMapper } from '../../gtfs/alerts/alerts-mapper';
import { AlertTextFormatter } from '../../../_core/utils/AlertTextFormatter';

function extractNumericId(guid?: string): number {
    if (!guid) return 0;
    const match = guid.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
}

function stripTweetPrefix(text?: string | null): string | null {
    if (!text) return null;
    return text.startsWith('TWEET:') ? text.slice(6).trim() : text.trim();
}

/**
 * KORDIS flattens HTML into one line: paragraph ends become runs of periods (`. .`, `..`, `:.`),
 * headings end with a spaced ` . ` and list items are an inline `•`. Restores them as line breaks.
 */
function restoreStructure(text: string): string {
    return text
        .replace(/:\s*\.(?:\s*\.)*\s*/g, ':\n\n')
        .replace(/\.(?:\s*\.)+\s*/g, '.\n\n')
        .replace(/[ \u00a0]+\.[ \u00a0]+/g, '\n')
        .replace(/\s*•\s*/g, '\n• ')
        .replace(/[ \u00a0]{2,}/g, ' ')
        .split('\n')
        .map(line => line.trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function parseIsDetour(alert: GtfsRt.IAlert, headerStr: string, rawHeader?: string | null, rawDesc?: string | null): boolean {
    const isTweet = Boolean(
        (rawHeader && rawHeader.toUpperCase().includes('TWEET')) ||
        (rawDesc && rawDesc.toUpperCase().includes('TWEET:'))
    );
    if (isTweet) {
        return false;
    }

    if (defaultParseIsDetour(alert)) {
        return true;
    }

    const combinedText = `${rawHeader || ''} ${headerStr} ${rawDesc || ''}`.toLowerCase();
    return combinedText.includes('výluka');
}

function parseContent(rawHeader?: string | null, rawDesc?: string | null): { title: string; description: string | null } {
    const cleanedDesc = AlertTextFormatter.fromHtml(stripTweetPrefix(rawDesc));
    const cleanedHeader = AlertTextFormatter.fromHtml(stripTweetPrefix(rawHeader)) || '';

    if (!cleanedDesc) {
        return { title: cleanedHeader, description: null };
    }

    const newlineIndex = cleanedDesc.indexOf('\n');
    if (newlineIndex !== -1) {
        const title = cleanedDesc.slice(0, newlineIndex).trim();
        const description = restoreStructure(cleanedDesc.slice(newlineIndex + 1));
        return {
            title: title || cleanedHeader,
            description: description || null
        };
    }

    return {
        title: cleanedDesc,
        description: null
    };
}

export function createKordisAlertsMapper(): AlertsMapper {
    const base = createGtfsAlertsMapper({ parseIsDetour, parseContent });
    return {
        mapAlerts(rawAlerts, forceIncident) {
            // Newest first (descending numeric ID).
            return base.mapAlerts(rawAlerts, forceIncident).sort((a, b) => extractNumericId(b.guid) - extractNumericId(a.guid));
        }
    };
}
