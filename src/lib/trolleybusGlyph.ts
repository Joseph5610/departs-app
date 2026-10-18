import type { IconNode } from 'lucide-react';

/**
 * Lucide's bus lowered 2 units under two trolley poles, so a trolleybus never reads as a bus; one shape for the
 * app's icons (`Trolleybus` in routeTypeIcons) and the map's stop badges.
 */
export const TROLLEYBUS_ICON_NODE: IconNode = [
    ['path', { d: 'M11 8 7 2', key: 'pole-left' }],
    ['path', { d: 'M16 8 12 2', key: 'pole-right' }],
    ['path', { d: 'M8 8v6', key: 'window-left' }],
    ['path', { d: 'M15 8v6', key: 'window-right' }],
    ['path', { d: 'M2 14h19.6', key: 'waist' }],
    ['path', { d: 'M18 20h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 8.8 19.1 8 18 8H4a2 2 0 0 0-2 2v10h3', key: 'body' }],
    ['circle', { cx: '7', cy: '20', r: '2', key: 'wheel-front' }],
    ['path', { d: 'M9 20h5', key: 'sill' }],
    ['circle', { cx: '16', cy: '20', r: '2', key: 'wheel-rear' }],
];
