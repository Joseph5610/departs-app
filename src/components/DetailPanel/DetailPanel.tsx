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
import { HStack } from '@/components/ui/layout';
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
            className="shrink-0 -ml-2 h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
        >
            <ArrowLeft size={20}  strokeWidth={1.5} />
        </Button>
    );

    const platformBadge = platformCode && (
        <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/10 border border-white/10 text-foreground text-[13px] font-bold tabular-nums mr-1.5">
            {platformCode}
        </span>
    );

    const headerContent = (
        <HStack justify="between" className="w-full items-center pt-2">
            <HStack className="gap-1 min-w-0 flex-1 items-center">
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
            </HStack>
            <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="shrink-0 rounded-full h-9 w-9 p-0 text-muted-foreground opacity-60 hover:opacity-100 hover:text-foreground"
            >
                <X size={20} strokeWidth={1.5}  />
            </Button>
        </HStack>
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
                    className="max-h-[96%] h-full flex flex-col pointer-events-auto glassy-tinted outline-none rounded-t-[32px]!"
                    hideOverlay={true}
                    aria-describedby={undefined}
                >
                    {/* 
                        Draggable Header Area:
                        With handleOnly removed, the ENTIRE DrawerContent is draggable by default.
                        The header (station name, subheader) is naturally part of the drag area.
                        No DrawerHandle component needed — just a visual bar.
                    */}
                    <div className="shrink-0 flex flex-col">
                        {/* Visual Handle Bar (purely cosmetic, not a DrawerHandle) */}
                        <div className="mx-auto mt-4 h-1.5 w-12 shrink-0 rounded-full bg-white/20 mb-2" />

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
                if (!open && details.reason !== 'outside-press' && details.reason !== 'focus-out' && details.reason !== 'escape-key') {
                    onClose();
                }
            }}
            modal={false}
        >
            <SheetContent
                side="left"
                showCloseButton={false}
                hideOverlay={true}
                variant="tinted"
                className="w-(--sidebar-width) sm:max-w-(--sidebar-width) top-5! left-5! bottom-5! h-[calc(100dvh-2.5rem)]! p-0 overflow-hidden flex flex-col outline-none border border-border rounded-3xl"
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
