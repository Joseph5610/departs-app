/** `list` with `item` added, or removed when already present. */
export const toggled = (list: string[], item: string): string[] =>
    list.includes(item) ? list.filter(i => i !== item) : [...list, item];

/** A place name that may wrap after its commas and slashes, as in "Kostelec n.L.,Martinská", instead of mid-word or mid-abbreviation. */
export const wrappableName = (name: string): string => name.replace(/([,/])(?=\S)/g, '$1\u200B');

/** `text` split before its last word, so that word can be kept on one line with what follows it. */
export const splitLastWord = (text: string): [string, string] => {
    const at = text.lastIndexOf(' ') + 1;
    return [text.slice(0, at), text.slice(at)];
};
