import { usePreferencesStore } from '@/state/preferencesStore';
import { useViewportWidth } from '@/hooks/useViewportWidth';
import { sidebarWidth } from '@/lib/sidebar';

/** The desktop panel's width in px: the one the user dragged to, held within what the window allows, or the default. */
export const useSidebarWidthPx = (): number => sidebarWidth(usePreferencesStore(s => s.sidebarWidthPx), useViewportWidth());
