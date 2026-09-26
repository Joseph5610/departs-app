/**
 * A lean extractor for PID's planned-exclusions RSS feed (`GOLEMIO_CONFIG.FEEDS.exclusions`,
 * ~450 KB, ~250 items): pulls out exactly the flat tags `pidRssItemSchema` reads, instead of
 * `fast-xml-parser`'s generic XMLParser building a full document tree, which cost 17-25ms on this
 * feed - CPU-killed on its own regardless of isolate warmth. Feeds `pidRssItemSchema` the same shape
 * `fast-xml-parser` would have, so validation and every transform downstream are unchanged.
 */

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

/** A tag's inner text, CDATA unwrapped (left literal, as `fast-xml-parser` leaves it) or entity-decoded and trimmed. */
function tagText(block: string, tag: string): string | undefined {
    const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>|<${tag}(?:\\s[^>]*)?\\/>`);
    const m = re.exec(block);
    if (!m) return undefined;
    const raw = m[1] ?? '';
    const cdata = /^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/.exec(raw);
    return cdata ? cdata[1] : decodeEntities(raw).trim();
}

/**
 * `<lines><line>A</line><line>B</line></lines>` as `fast-xml-parser` would shape it: one string or an
 * array of them. `undefined` only when the `<lines>` tag itself is absent - present but empty is `''`
 * (fast-xml-parser's own reading of an empty element), which `pidRssItemSchema` treats differently.
 */
function readLines(block: string): { line: string | string[] } | '' | undefined {
    const linesBlock = /<lines(?:\s[^>]*)?>([\s\S]*?)<\/lines>/.exec(block)?.[1];
    if (linesBlock === undefined) return undefined;
    const lines = [...linesBlock.matchAll(/<line(?:\s[^>]*)?>([\s\S]*?)<\/line>/g)].map(m => decodeEntities(m[1]).trim());
    if (lines.length === 0) return '';
    return { line: lines.length === 1 ? lines[0] : lines };
}

/** One `<item>` as a plain object shaped like `fast-xml-parser`'s output, ready for `pidRssItemSchema`. */
function readRssItem(block: string): Record<string, unknown> {
    const item: Record<string, unknown> = {};
    for (const tag of ['title', 'pubDate', 'guid', 'link', 'priority', 'content:encoded', 'description', 'date', 'dateFrom', 'dateTo']) {
        const value = tagText(block, tag);
        if (value !== undefined) item[tag] = value;
    }
    const lines = readLines(block);
    if (lines !== undefined) item.lines = lines;
    return item;
}

/** Every `<item>` in an RSS `<channel>`, in document order. */
export function readRssItems(xml: string): Record<string, unknown>[] {
    return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/g)].map(m => readRssItem(m[1]));
}
