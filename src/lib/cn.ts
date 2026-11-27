import { createCn } from 'cn/config';

/**
 * The app's class-name merger: `cn` taught the type scale in index.css (`text-body-sm`, `text-title`...),
 * which it would otherwise read as colours and drop next to a `text-foreground`.
 */
export const cn = createCn({
    extend: {
        theme: {
            radius: ['sheet', 'surface', 'nested', 'badge', 'badge-fluid'],
            spacing: ['control-sm', 'control-md', 'control-lg', 'board-gutter', 'board-gap', 'board-badge-col', 'board-badge', 'board-tile'],
        },
        classGroups: {
            'type-style': [{ type: ['display', 'title', 'section', 'headsign', 'row', 'field', 'group', 'meta', 'note', 'control', 'label', 'badge', 'micro', 'pill'] }],
            'font-size': [{ text: ['nano', 'micro', 'label', 'badge', 'caption', 'body-sm', 'title', 'heading', 'board-display', 'board-headsign', 'board-badge', 'board-empty', 'board-notice', 'board-meta'] }],
        },
    },
});
