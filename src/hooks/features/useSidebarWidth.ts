import { useLayoutEffect } from 'react';
import { useSidebarWidthPx } from '@/hooks/derived/useSidebarWidthPx';
import { applySidebarWidth } from '@/lib/sidebar';

/** Keeps the root's `--sidebar-width` at the panel's width, set before the first paint so nothing jumps. */
export const useSidebarWidth = () => {
    const width = useSidebarWidthPx();
    useLayoutEffect(() => applySidebarWidth(width), [width]);
};
