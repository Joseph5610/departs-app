import { SIDEBAR } from '@/config/constants';

/** The widest the panel may be in a viewport `viewportWidth` wide; never below its minimum. */
export const maxSidebarWidth = (viewportWidth: number): number =>
    Math.round(Math.max(SIDEBAR.MIN_WIDTH_PX, Math.min(SIDEBAR.MAX_WIDTH_PX, viewportWidth * SIDEBAR.MAX_VIEWPORT_RATIO)));

/** `width` held within the panel's limits for a viewport `viewportWidth` wide. */
export const clampSidebarWidth = (width: number, viewportWidth: number): number =>
    Math.round(Math.max(SIDEBAR.MIN_WIDTH_PX, Math.min(width, maxSidebarWidth(viewportWidth))));

/** A stored width within the panel's fixed limits; 0 (the default) for anything not a usable width. */
export const storedSidebarWidth = (width: number): number =>
    Number.isFinite(width) && width > 0 ? Math.round(Math.min(Math.max(width, SIDEBAR.MIN_WIDTH_PX), SIDEBAR.MAX_WIDTH_PX)) : 0;

/** The panel's width in a viewport `viewportWidth` wide: the `stored` one the user dragged to, or the default for 0. */
export const sidebarWidth = (stored: number, viewportWidth: number): number =>
    clampSidebarWidth(stored > 0 ? stored : Math.min(viewportWidth * SIDEBAR.DEFAULT_VIEWPORT_RATIO, SIDEBAR.DEFAULT_MAX_WIDTH_PX), viewportWidth);

/** Sets the desktop panel's width on the root, where the panel and the controls centred beside it read it. */
export const applySidebarWidth = (width: number): void => {
    document.documentElement.style.setProperty('--sidebar-width', `${width}px`);
};

/** Marks the root while the user drags the panel edge, so what follows it stops easing. */
export const setSidebarResizing = (resizing: boolean): void => {
    document.documentElement.toggleAttribute('data-sidebar-resizing', resizing);
};
