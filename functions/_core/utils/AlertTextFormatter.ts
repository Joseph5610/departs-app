const HTML_ENTITY_MAP: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'"
};

/**
 * Turns upstream alert text (HTML or plain) into display text for any adapter's alert mapper.
 */
export class AlertTextFormatter {
    /**
     * Strips HTML tags while preserving structure: <br>, block elements (<p>, <div>, headings, lists),
     * \t and existing newlines become line breaks, list items become `• ` lines, and entities are decoded.
     */
    static fromHtml(text: string | null | undefined): string | null {
        if (!text) return null;

        const cleaned = text
            .replace(/<br\s*\/?>/gi, '\n')
            // `[^>]*` not `.*?` — `.` skips newlines, so tags wrapped across lines would survive.
            .replace(/<li\b[^>]*>/gi, '\n• ')
            .replace(/<\/(p|div|li|ul|ol|h[1-6])>/gi, '\n')
            .replace(/<(p|div|ul|ol|h[1-6])\b[^>]*>/gi, '\n')
            .replace(/<[^>]*>/g, '')
            .replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/gi, (match) => HTML_ENTITY_MAP[match.toLowerCase()] || match)
            .replace(/[\r\t]+/g, '\n');

        const lines = cleaned.split('\n').map(l => l.replace(/[ \u00a0]{2,}/g, ' ').trim());
        const resultLines: string[] = [];
        let previousWasEmpty = false;

        for (const line of lines) {
            if (line === '' || line === '•') {
                if (!previousWasEmpty) {
                    resultLines.push('');
                    previousWasEmpty = true;
                }
            } else {
                // List items stay contiguous with each other and with their heading.
                if (line.startsWith('• ') && previousWasEmpty && resultLines.length > 0) {
                    resultLines.pop();
                }
                resultLines.push(line);
                previousWasEmpty = false;
            }
        }

        const result = resultLines.join('\n').trim();
        return result || null;
    }
}
