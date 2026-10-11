import type React from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import type { FavoriteDragHandle } from './DragHandle';

interface SortableFavoriteProps<T> {
    value: T;
    /** False leaves the card without a drag handle, as when it is the only one. */
    sortable: boolean;
    /** Moves the card `delta` places, for the handle's arrow keys. */
    onMove: (value: T, delta: number) => void;
    children: (handle: FavoriteDragHandle | undefined) => React.ReactNode;
}

/** One card in the favourites' reorderable list, dragged only by its handle so rows stay tappable and the sheet scrollable. */
export function SortableFavorite<T>({ value, sortable, onMove, children }: SortableFavoriteProps<T>) {
    const controls = useDragControls();
    const handle: FavoriteDragHandle | undefined = sortable
        ? { start: (e) => controls.start(e), move: (delta) => onMove(value, delta) }
        : undefined;

    return (
        <Reorder.Item
            as="div"
            value={value}
            dragListener={false}
            dragControls={controls}
            // Position only: a size animation would stretch the text when a row changes height.
            layout="position"
            className="relative"
            whileDrag={{ zIndex: 10 }}
        >
            <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
                {children(handle)}
            </div>
        </Reorder.Item>
    );
}
