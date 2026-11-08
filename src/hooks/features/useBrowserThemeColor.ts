import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { BROWSER_THEME_COLOR } from '@/config/constants';

/** Tints the browser's bars like the sheet in the app's own theme, which may differ from the system's. */
export const useBrowserThemeColor = () => {
    const { resolvedTheme } = useTheme();
    useEffect(() => {
        const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
        if (meta) meta.content = BROWSER_THEME_COLOR[resolvedTheme === 'light' ? 'light' : 'dark'];
    }, [resolvedTheme]);
};
