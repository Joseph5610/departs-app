import React, { useState, useEffect } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { MOBILE_BREAKPOINT } from '../../config/constants';
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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DetailPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onBack?: () => void;
    title?: string;
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
export const DetailPanel: React.FC<DetailPanelProps> = React.memo(({ isOpen, onClose, onBack, title, platformCode, subHeader, children }) => {
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const backButton = onBack && (
        <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="shrink-0 -ml-2 h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
        >
            <ArrowLeft size={20} />
        </Button>
    );

    const platformBadge = platformCode && (
        <Badge variant="outline" className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-muted border border-border text-muted-foreground text-[13px] font-bold tabular-nums p-0">
            {platformCode}
        </Badge>
    );

    const headerContent = (
        <HStack justify="between" className="w-full">
            <HStack className="gap-2 min-w-0 flex-1">
                {backButton}
                <HStack className="gap-2 min-w-0 flex-1">
                    {isMobile ? (
                        <DrawerTitle className="text-xl font-bold text-foreground truncate tracking-tight">
                            {title || ''}
                        </DrawerTitle>
                    ) : (
                        <SheetTitle className="text-xl font-bold text-foreground truncate tracking-tight text-left">
                            {title || ''}
                        </SheetTitle>
                    )}
                    {platformBadge}
                </HStack>
            </HStack>
            <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="shrink-0 rounded-full h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
            >
                <X size={20} />
            </Button>
        </HStack>
    );

    const [activeSnapPoint, setActiveSnapPoint] = useState<number | string | null>(0.60);

    // Reset snap point only when the drawer opens (not on title changes within a session)
    useEffect(() => {
        if (isOpen) {
            setActiveSnapPoint(0.60);
        }
    }, [isOpen]);

    if (isMobile) {
        return (
            <Drawer
                open={isOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        onClose();
                    }
                }}
                snapPoints={[0.60, 0.80]}
                activeSnapPoint={activeSnapPoint}
                setActiveSnapPoint={setActiveSnapPoint}
                modal={false}
                dismissible={true}
                shouldScaleBackground={false}
                disablePreventScroll={true}
                noBodyStyles={true}
            >
                <DrawerContent
                    className="max-h-[96%] h-full flex flex-col pointer-events-auto glassy-tinted outline-none rounded-t-[32px]! border-t border-white/10"
                    hideOverlay={true}
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
                        className="flex-1 overflow-y-auto px-6 pointer-events-auto overscroll-contain custom-scrollbar"
                    >
                        <div className="pb-[50dvh]">
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
                className="w-[420px] sm:max-w-[420px] !top-5 !left-5 !bottom-5 !h-[calc(100dvh-2.5rem)] p-0 overflow-hidden flex flex-col outline-none border border-border rounded-3xl"
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
