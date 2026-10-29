import { describe, expect, it } from 'vitest';
import { SIDEBAR } from '@/config/constants';
import { sidebarWidth } from './sidebar';

describe('sidebarWidth', () => {
    it('grows the default with the window up to its cap', () => {
        expect(sidebarWidth(0, 1000)).toBe(SIDEBAR.MIN_WIDTH_PX);
        expect(sidebarWidth(0, 1800)).toBe(Math.round(1800 * SIDEBAR.DEFAULT_VIEWPORT_RATIO));
        expect(sidebarWidth(0, 4000)).toBe(SIDEBAR.DEFAULT_MAX_WIDTH_PX);
    });

    it('keeps a dragged width the window allows and caps one it does not', () => {
        expect(sidebarWidth(700, 1600)).toBe(700);
        expect(sidebarWidth(880, 1200)).toBe(1200 * SIDEBAR.MAX_VIEWPORT_RATIO);
    });
});
