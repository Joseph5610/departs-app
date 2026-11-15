import { useCallback, useRef, useState } from 'react';
import type React from 'react';
import { SHEET } from '@/config/constants';
import { scrollTravel, toolbarFolded } from '@/lib/sheetMorph';

/** Folds the sheet's toolbar while its list scrolls; a new `scope` (another card or height) starts unfolded. */
export const useToolbarFold = (scope: string) => {
    const [fold, setFold] = useState({ scope, folded: false });
    const run = useRef({ scope, top: 0, travel: 0 });

    const onScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
        const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
        // iOS reports its bounce past the ends as scrolling.
        const top = Math.min(Math.max(0, scrollTop), scrollHeight - clientHeight);
        const last = run.current.scope === scope ? run.current : { scope, top: 0, travel: 0 };
        const travel = scrollTravel(last.travel, top - last.top);
        run.current = { scope, top, travel };
        setFold(prev => ({
            scope,
            folded: toolbarFolded(prev.scope === scope && prev.folded, top, travel, { startPx: SHEET.TOOLBAR_SCROLL_START_PX, runPx: SHEET.TOOLBAR_SCROLL_RUN_PX }),
        }));
    }, [scope]);

    return { folded: fold.scope === scope && fold.folded, onScroll };
};
