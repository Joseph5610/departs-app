import React, { useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import {
    Drawer,
    DrawerContent,
    DrawerTitle,
} from '@/components/ui/drawer';
import {
    Sheet,
    SheetContent,
    SheetTitle,
    type DialogRootChangeEventDetails
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '../../hooks/useIsMobile';

import { ScrollArea } from '@/components/ui/scroll-area';

interface DetailPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onBack?: () => void;
    title?: string;
    id?: string;
    platformCode?: string;
    subHeader?: React.ReactNode;
    children: React.ReactNode;
}

/**
 * DetailPanel
 *
 * Responsive panel for displaying stop and vehicle details.
 * Uses a sidebar (Sheet) on desktop and a bottom drawer (vaul) on mobile.
 */
export const DetailPanel: React.FC<DetailPanelProps> = React.memo(({ isOpen, onClose, onBack, title, id, platformCode, subHeader, children }) => {
    const isMobile = useIsMobile();

    const backButton = onBack && (
        <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="shrink-0 -ml-2 h-9 w-9 text-muted-foreground"
        >
            <ArrowLeft size={20}  strokeWidth={1.5} />
        </Button>
    );

    const platformBadge = platformCode && (
        <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-muted/50 border text-foreground text-[13px] font-bold tabular-nums mr-1.5">
            {platformCode}
        </span>
    );

    const headerContent = (
        <div className="flex w-full items-center justify-between pt-2">
            <div className="flex gap-1 min-w-0 flex-1 items-center">
                {backButton}
                {platformBadge}
                {isMobile ? (
                    <DrawerTitle className="text-xl font-semibold text-foreground line-clamp-2 tracking-tight leading-tight">
                        {title || ''}
                    </DrawerTitle>
                ) : (
                    <SheetTitle className="text-xl font-semibold text-foreground line-clamp-2 tracking-tight text-left leading-tight">
                        {title || ''}
                    </SheetTitle>
                )}
            </div>
            <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="Close"
                data-testid="detail-panel-close"
                className="shrink-0 h-9 w-9 text-muted-foreground"
            >
                <X size={20} strokeWidth={1.5}  />
            </Button>
        </div>
    );

    const [activeSnapPoint, setActiveSnapPoint] = useState<number | string | null>(0.60);

    // Reset snap point when selection changes (id change) during render
    const [prevId, setPrevId] = useState(id);
    if (id !== prevId) {
        setPrevId(id);
        setActiveSnapPoint(0.60);
    }

    if (isMobile) {
        return (
            <Drawer
                open={isOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        onClose();
                    }
                }}
                snapPoints={[0.18, 0.60, 0.80]}
                activeSnapPoint={activeSnapPoint}
                setActiveSnapPoint={setActiveSnapPoint}
                modal={false}
                dismissible={true}
                shouldScaleBackground={false}
                disablePreventScroll={true}
                noBodyStyles={true}
            >
                <DrawerContent
                    className="max-h-[96%] h-full flex flex-col pointer-events-none glassy outline-none rounded-t-[32px]!"
                    hideOverlay={true}
                    aria-describedby={undefined}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                >
                    {/* 
                        Draggable Header Area:
                        With handleOnly removed, the ENTIRE DrawerContent is draggable by default.
                        The header (station name, subheader) is naturally part of the drag area.
                        No DrawerHandle component needed — just a visual bar.
                    */}
                    <div className="shrink-0 flex flex-col pointer-events-auto">
                        {/* Visual Handle Bar (purely cosmetic, not a DrawerHandle) */}
                        <div className="mx-auto mt-4 h-1.5 w-12 shrink-0 rounded-full bg-border mb-2" />

                        <div className="mt-2 px-6 pb-2">
                            {headerContent}
                        </div>

                        {subHeader && (
                            <div className="w-full">
                                {subHeader}
                            </div>
                        )}
                    </div>

                    {/* 
                        Scrollable Content Area:
                        data-vaul-no-drag prevents scrolling here from triggering drawer drag.
                        This is the standard vaul pattern for large drag areas.
                    */}
                    <div
                        data-vaul-no-drag
                        className="flex-1 min-h-0 overflow-y-auto px-6 pointer-events-auto overscroll-contain custom-scrollbar"
                    >
                        <div className="pb-[45dvh]">
                            {children}
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>
        );
    }

    return (
        <Sheet
            open={isOpen}
            onOpenChange={(open: boolean, details: DialogRootChangeEventDetails) => {
                // If it's closed internally (e.g. escape key), we call onClose.
                // We ignore outside-press and focus-out because pointer dismissal is disabled.
                if (!open && details.reason !== 'outside-press' && details.reason !== 'focus-out') {
                    onClose();
                }
            }}
            modal={false}
            disablePointerDismissal={true}
        >
            <SheetContent
                side="left"
                showCloseButton={false}
                hideOverlay={true}
                className="w-(--sidebar-width) sm:max-w-(--sidebar-width) top-5! left-5! bottom-5! h-[calc(100dvh-2.5rem)]! p-0 overflow-hidden flex flex-col outline-none glassy rounded-3xl"
                aria-describedby={undefined}
                data-testid="detail-panel"
            >
                <div className="shrink-0 flex flex-col">
                    <div className="px-6 pt-6 pb-2">
                        {headerContent}
                    </div>
                    {subHeader && (
                        <div className="w-full">
                            {subHeader}
                        </div>
                    )}
                </div>
                <ScrollArea className="flex-1 min-h-0 px-6 pb-6">
                    {children}
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
});

DetailPanel.displayName = 'DetailPanel';
