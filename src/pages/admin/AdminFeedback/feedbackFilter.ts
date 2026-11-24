import type { StoredFeedback } from '@/types';

export type FeedbackKind = 'all' | 'feedback' | 'crash';

/** The reports of one kind whose text, ids, contact or diagnostics contain `query`. */
export const filterFeedback = (items: readonly StoredFeedback[], kind: FeedbackKind, query: string): StoredFeedback[] => {
    const search = query.trim().toLowerCase();
    return items.filter(item => {
        if (kind === 'crash' && item.type !== 'crash') return false;
        if (kind === 'feedback' && item.type === 'crash') return false;
        if (!search) return true;
        return [item.message, item.type, item.id, item.email, item.ipAddress, item.diagnostics && JSON.stringify(item.diagnostics)]
            .some(text => text?.toLowerCase().includes(search));
    });
};
