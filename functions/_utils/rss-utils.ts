/**
 * Extracts content from an XML tag using regex and cleans up CDATA and common entities.
 *
 * @param xml XML string to search in
 * @param tag Tag name to extract (case-insensitive)
 * @returns Inner text content of the tag
 */
export const getXMLTagContent = (xml: string, tag: string): string => {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return (match ? match[1] : "")
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&nbsp;/g, ' ')
        .trim();
};
