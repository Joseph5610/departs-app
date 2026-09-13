import type { SearchHistoryBase } from '../types/search';

/** Identity of a history entry; two entries with the same key are the same search. */
export const searchHistoryKey = (item: SearchHistoryBase): string => {
    switch (item.type) {
        case 'stop': return `stop-${item.stop_id}`;
        case 'place': return `place-${item.place_id}`;
        case 'line': return `line-${item.lines.join('-')}`;
    }
};
