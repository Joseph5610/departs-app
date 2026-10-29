import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useSidebarWidthPx } from '@/hooks/derived/useSidebarWidthPx';
import { useViewportWidth } from '@/hooks/useViewportWidth';
import { applySidebarWidth, clampSidebarWidth, maxSidebarWidth, setSidebarResizing } from '@/lib/sidebar';
import { SIDEBAR } from '@/config/constants';

interface Drag {
    startX: number;
    startWidth: number;
    width: number;
    /** The drag has written a width on the root, which the store must now take. */
    moved: boolean;
}

/** The desktop panel's right edge: drag or arrow keys resize the panel, a double click restores the default width. */
export const SidebarResizeHandle = () => {
    const { t } = useTranslation();
    const width = useSidebarWidthPx();
    const maxWidth = maxSidebarWidth(useViewportWidth());
    const setWidth = usePreferencesStore(s => s.actions.setSidebarWidthPx);
    const drag = useRef<Drag | null>(null);
    const [dragWidth, setDragWidth] = useState<number | null>(null);

    const endDrag = () => {
        const ended = drag.current;
        drag.current = null;
        if (!ended?.moved) return;
        setSidebarResizing(false);
        setDragWidth(null);
        setWidth(ended.width);
    };

    // Closing the panel mid-drag still stores the width already shown.
    const endDragRef = useRef(endDrag);
    useEffect(() => {
        endDragRef.current = endDrag;
    });
    useEffect(() => () => endDragRef.current(), []);

    const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { startX: event.clientX, startWidth: width, width, moved: false };
    };

    // Writes the root variable directly while dragging; the store only takes the final width.
    const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const current = drag.current;
        if (!current) return;
        const next = clampSidebarWidth(current.startWidth + event.clientX - current.startX, window.innerWidth);
        if (next === current.width) return;
        if (!current.moved) setSidebarResizing(true);
        current.width = next;
        current.moved = true;
        applySidebarWidth(next);
        setDragWidth(next);
    };

    // A key that cannot move the panel further keeps the stored width, which a wider window may still allow.
    const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        const step = event.key === 'ArrowRight' ? SIDEBAR.KEY_STEP_PX : event.key === 'ArrowLeft' ? -SIDEBAR.KEY_STEP_PX : 0;
        if (!step) return;
        event.preventDefault();
        const next = clampSidebarWidth(width + step, window.innerWidth);
        if (next !== width) setWidth(next);
    };

    return (
        <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t('common.resizePanel')}
            aria-valuemin={SIDEBAR.MIN_WIDTH_PX}
            aria-valuemax={maxWidth}
            aria-valuenow={dragWidth ?? width}
            tabIndex={0}
            data-testid="sidebar-resize-handle"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onLostPointerCapture={endDrag}
            onDoubleClick={() => setWidth(0)}
            onKeyDown={onKeyDown}
            // Mostly outside the panel, so the scroll bar along its edge stays usable.
            className="group absolute inset-y-0 -right-3 z-10 w-4 cursor-col-resize touch-none outline-none"
        >
            <div className="absolute inset-y-6 left-1 w-0.5 -translate-x-1/2 rounded-full bg-primary opacity-0 transition-opacity group-hover:opacity-100 group-hover:delay-150 group-focus-visible:opacity-100 in-data-sidebar-resizing:opacity-100 in-data-sidebar-resizing:delay-0" />
        </div>
    );
};
