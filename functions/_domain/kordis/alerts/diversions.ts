import type { AppAlert } from '../../../_core/types';
import { zonedLocalToEpochMs } from '../../../_core/utils/time';
import type { KordisDiversion } from '../../../_feeds/kordis/diversions';
import { KORDIS_CONFIG } from '../../../_feeds/kordis/config';
import { cleanLineNames } from './lineNames';

/** One diversion, read once per snapshot: how it is matched, its validity window and the alert it becomes while upcoming. */
export interface IndexedDiversion {
    id: number;
    key: string;
    /** The start of its text, telling apart records that share a title. */
    textKey: string;
    /** Its closure number when it is a real one; records sharing it are one closure. */
    closure: string | null;
    from: number | null;
    to: number | null;
    alert: AppAlert;
}

const titleKey = (title: string): string => title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/** Enough of a text's start to tell two notices about one closure apart. */
const textKeyOf = (text: string | null | undefined): string => titleKey(text ?? '').slice(0, 60);

const asText = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/** `dd.MM.yyyy HH:mm` Prague wall-clock as epoch ms, null when unreadable. */
function parseLocal(value: unknown, timezone: string): number | null {
    const m = typeof value === 'string' && /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})$/.exec(value.trim());
    return m ? zonedLocalToEpochMs(`${m[3]}-${m[2]}-${m[1]} ${m[4]}:${m[5]}`, timezone) : null;
}

const toIso = (ms: number | null): string | null => (ms === null ? null : new Date(ms).toISOString());

const cleanText = (text: string | null): string | null => {
    const lines = text?.split('\n').map(line => line.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    return lines || null;
};

/**
 * The diversions with a title and at least one readable date, soonest start first. Built once per
 * snapshot, so a request only compares windows against its own clock.
 */
export function indexDiversions(diversions: readonly KordisDiversion[], timezone: string, link: string): IndexedDiversion[] {
    const indexed: IndexedDiversion[] = [];
    for (const d of diversions) {
        const title = asText(d?.title)?.trim();
        if (!title) continue;
        const from = parseLocal(d.validfrom, timezone);
        const to = parseLocal(d.validto, timezone);
        if (from === null && to === null) continue;
        const type = asText(d.type_);
        const number = asText(d.number_)?.trim() ?? '';
        const publicText = cleanText(asText(d.publictext));
        indexed.push({
            id: Number(d.diversionid) || 0,
            key: titleKey(title),
            textKey: textKeyOf(publicText),
            closure: KORDIS_CONFIG.DIVERSION_NUMBER_PATTERN.test(number) ? number : null,
            from,
            to,
            alert: {
                type: 'exclusion',
                title,
                description: publicText,
                link,
                valid_from: toIso(from),
                valid_to: toIso(to),
                guid: `diversion_${d.diversionid}`,
                priority: 'normal',
                lines: cleanLineNames((asText(d.affectedlines) ?? '').split(',')),
                effect: type ? KORDIS_CONFIG.DIVERSION_EFFECTS[type] : undefined,
            },
        });
    }
    return indexed.sort((a, b) => (a.from ?? 0) - (b.from ?? 0));
}

/** The running diversion an RT alert stands for: the only one with its title, else the one whose text it starts with. */
function matchOf(alert: AppAlert, candidates: IndexedDiversion[] | undefined): IndexedDiversion | undefined {
    if (!candidates || candidates.length <= 1) return candidates?.[0];
    const textKey = textKeyOf(alert.description);
    return candidates.find(d => d.textKey === textKey);
}

/**
 * Enriches the RT alerts with the diversions published by Brno open data, which lag the RT feed by up to a day.
 * The RT list stays authoritative for what runs now: a matched lockout only gains the validity window it lacks,
 * and only while that window still holds `nowMs`; of several lockouts posted for one closure (same closure
 * number) only the newest is kept; diversions starting after `nowMs` that the RT feed does not already list are
 * appended as upcoming exclusions, again only the newest of each closure; everything else is ignored. Returns `alerts` itself when nothing changes.
 */
export function enrichWithDiversions(alerts: AppAlert[], diversions: readonly IndexedDiversion[], nowMs: number): AppAlert[] {
    if (diversions.length === 0) return alerts;

    const current = new Map<string, IndexedDiversion[]>();
    const upcoming: IndexedDiversion[] = [];
    for (const d of diversions) {
        if (d.from !== null && d.from > nowMs) upcoming.push(d);
        else if (d.to === null || d.to > nowMs) {
            const same = current.get(d.key);
            if (same) same.push(d);
            else current.set(d.key, [d]);
        }
    }

    const rtKeys = new Set<string>();
    const matches = alerts.map(alert => {
        const key = titleKey(alert.title);
        rtKeys.add(key);
        return alert.type === 'exclusion' ? matchOf(alert, current.get(key)) : undefined;
    });

    const newestOfClosure = new Map<string, number>();
    for (const match of matches) {
        if (match?.closure && match.id > (newestOfClosure.get(match.closure) ?? -1)) newestOfClosure.set(match.closure, match.id);
    }

    let changed = false;
    const enriched: AppAlert[] = [];
    alerts.forEach((alert, i) => {
        const match = matches[i];
        if (match?.closure && newestOfClosure.get(match.closure) !== match.id) {
            changed = true;
            return;
        }
        if (!match || alert.valid_from || alert.valid_to) {
            enriched.push(alert);
            return;
        }
        changed = true;
        enriched.push({ ...alert, valid_from: match.alert.valid_from, valid_to: match.alert.valid_to });
    });

    const newestUpcoming = new Map<string, number>();
    for (const d of upcoming) {
        if (d.closure && d.id > (newestUpcoming.get(d.closure) ?? -1)) newestUpcoming.set(d.closure, d.id);
    }
    const added = upcoming
        .filter(d => !rtKeys.has(d.key) && (!d.closure || newestUpcoming.get(d.closure) === d.id))
        .map(d => d.alert);
    if (added.length === 0) return changed ? enriched : alerts;
    return [...enriched, ...added];
}
