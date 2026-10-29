import { cn } from '@/lib/cn';

interface MapTopCenterProps {
    /** The desktop panel is open, so the controls centre on the map beside it. */
    isPanelOpen: boolean;
    children: React.ReactNode;
}

/**
 * The part of the map the desktop panel leaves visible: the controls centred over the map sit in it,
 * so they all slide together, in one transition, when the panel opens or closes.
 */
export const MapTopCenter = ({ isPanelOpen, children }: MapTopCenterProps) => {
    return (
        <div
            className={cn(
                // Follows the panel edge without easing while the user drags it.
                "absolute inset-0 pointer-events-none transition-[left] duration-300 ease-in-out in-data-sidebar-resizing:transition-none",
                isPanelOpen && "md:left-[calc(var(--sidebar-width)+var(--sidebar-inset))]"
            )}
        >
            {children}
        </div>
    );
};
