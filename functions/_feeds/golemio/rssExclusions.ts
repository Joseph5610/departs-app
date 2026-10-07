/**
 * A lean extractor for PID's planned-exclusions RSS feed (`GOLEMIO_CONFIG.FEEDS.exclusions`,
 * ~450 KB, ~250 items): pulls out exactly the flat tags an item carries, instead of a generic XML
 * parser building a full document tree. Every value is text it extracted itself, so items come out
 * typed and need no schema pass.
 */

/** One planned exclusion as the feed states it; absent tags stay undefined. */
export interface PidRssItem {
    title?: string;
    pubDate?: string;
    guid?: string | null;
    link?: string;
    priority?: string | null;
    'content:encoded'?: string | null;
    description?: string | null;
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    lines?: string[] | null;
}

const XML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeEntities(text: string): string {
    if (!text.includes('&')) return text;
    return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, entity: string) => {
        if (entity[0] === '#') {
            const isHex = entity[1] === 'x' || entity[1] === 'X';
            const code = isHex ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
            return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
        }
        return XML_ENTITIES[entity] ?? whole;
    });
}

/**
 * The raw inner text of the first `<tag>…</tag>` (or `''` for `<tag/>`), found as the regex
 * `<tag(?:\s[^>]*)?>([\s\S]*?)<\/tag>|<tag(?:\s[^>]*)?\/>` would, without compiling one per tag and item.
 */
function tagInner(block: string, tag: string): string | undefined {
    const open = `<${tag}`;
    const close = `</${tag}>`;
    for (let at = block.indexOf(open); at >= 0; at = block.indexOf(open, at + 1)) {
        const next = at + open.length;
        const c = block[next];
        if (c === '>') {
            const end = block.indexOf(close, next + 1);
            if (end >= 0) return block.slice(next + 1, end);
        } else if (c === '/' && block[next + 1] === '>') {
            return '';
        } else if (c !== undefined && /\s/.test(c)) {
            const gt = block.indexOf('>', next);
            if (gt >= 0) {
                const end = block.indexOf(close, gt + 1);
                if (end >= 0) return block.slice(gt + 1, end);
                if (block[gt - 1] === '/') return '';
            }
        }
    }
    return undefined;
}

/** A tag's inner text, CDATA unwrapped (left literal) or entity-decoded and trimmed. */
function tagText(block: string, tag: string): string | undefined {
    const raw = tagInner(block, tag);
    if (raw === undefined) return undefined;
    const cdata = /^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/.exec(raw);
    return cdata ? cdata[1] : decodeEntities(raw).trim();
}

/** The `<line>` values of `<lines>`; null when the tag is present but empty, undefined when absent. */
function readLines(block: string): string[] | null | undefined {
    const linesBlock = /<lines(?:\s[^>]*)?>([\s\S]*?)<\/lines>/.exec(block)?.[1];
    if (linesBlock === undefined) return undefined;
    const lines = [...linesBlock.matchAll(/<line(?:\s[^>]*)?>([\s\S]*?)<\/line>/g)].map(m => decodeEntities(m[1]).trim());
    return lines.length === 0 ? null : lines;
}

/** Empty text as null, absent as undefined. */
const orNull = (v: string | undefined): string | null | undefined => (v === undefined ? undefined : v || null);

function readRssItem(block: string): PidRssItem {
    const text = (tag: string) => tagText(block, tag);
    return {
        title: text('title')?.trim(),
        pubDate: text('pubDate')?.trim(),
        guid: orNull(text('guid')?.trim()),
        link: text('link')?.trim(),
        priority: orNull(text('priority')?.trim()),
        'content:encoded': orNull(text('content:encoded')),
        description: orNull(text('description')),
        date: text('date'),
        dateFrom: text('dateFrom'),
        dateTo: text('dateTo'),
        lines: readLines(block),
    };
}

/** Every `<item>` in an RSS `<channel>`, in document order. */
export function readRssItems(xml: string): PidRssItem[] {
    return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/g)].map(m => readRssItem(m[1]));
}
