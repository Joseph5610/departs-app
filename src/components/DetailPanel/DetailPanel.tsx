import React, { useState, useEffect } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { MOBILE_BREAKPOINT } from '../../config/constants';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerHandle,
} from '@/components/ui/drawer';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Box, HStack } from '@/components/ui/layout';

interface DetailPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onBack?: () => void;
    title?: string;
    platformCode?: string;
    children: React.ReactNode;
}

/**
 * DetailPanel
 *
 * Simplified to a single 0.5 snap point for mobile.
 * Removed complex snap state management to improve stability.
 */
export const DetailPanel: React.FC<DetailPanelProps> = React.memo(({ isOpen, onClose, onBack, title, platformCode, children }) => {
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const headerContent = (
        <Stack className="w-full gap-0 items-center">
            {isMobile && (
                <div className="mx-auto mt-4 h-1.5 w-12 shrink-0 rounded-full bg-muted mb-4" />
            )}
            <HStack className="justify-between w-full">
                <HStack className="gap-2 min-w-0">
                    {onBack && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onBack}
                            className="shrink-0 -ml-2 h-10 w-10 text-muted-foreground hover:text-foreground"
                        >
                            <ArrowLeft size={20} />
                        </Button>
                    )}
                    <HStack className="gap-2 min-w-0">
                        <h2 className="text-xl font-bold text-foreground truncate tracking-tight">
                            {title || ''}
                        </h2>
                        {platformCode && (
                            <Box className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-muted border border-border text-muted-foreground text-[13px] font-black tabular-nums">
                                {platformCode}
                            </Box>
                        )}
                    </HStack>
                </HStack>
                {!isMobile && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="shrink-0 -mr-2 h-10 w-10 text-muted-foreground hover:text-foreground"
                    >
                        <X size={20} />
                    </Button>
                )}
            </HStack>
        </Stack>
    );

    if (isMobile) {
        return (
            <Drawer
                open={isOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        onClose();
                    }
                }}
                dismissible={true}
                handleOnly={true}
                shouldScaleBackground={false}
            >
                <DrawerContent
                    className="glassy-surface !rounded-t-3xl border-none shadow-2xl"
                    showHandle={false}
                >
                    <div className="flex flex-col max-h-[82dvh] min-h-0 overflow-hidden">
                        <DrawerHandle className="block w-full">
                            <DrawerHeader className="px-6 pt-0 pb-4 text-left shrink-0 cursor-grab active:cursor-grabbing">
                                <DrawerTitle className="text-left">
                                    {headerContent}
                                </DrawerTitle>
                            </DrawerHeader>
                        </DrawerHandle>
                        <Box className="flex-1 min-h-0 px-6 overflow-y-auto custom-scrollbar pb-[env(safe-area-inset-bottom,1.5rem)] touch-pan-y">
                            {children}
                        </Box>
                    </div>
                </DrawerContent>
            </Drawer>
        );
    }

    return (
        <Sheet
            open={isOpen}
            onOpenChange={(open, event) => {
                if (!open && event.reason !== 'outside-press' && event.reason !== 'focus-out' && event.reason !== 'escape-key') {
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
                className="w-[420px] sm:max-w-[420px] !top-5 !left-5 !bottom-5 !h-auto rounded-3xl glassy-surface p-0 overflow-hidden flex flex-col outline-none border-none shadow-2xl"
            >
                <SheetHeader className="px-6 pt-6 pb-2 shrink-0">
                    <SheetTitle>
                        {headerContent}
                    </SheetTitle>
                </SheetHeader>
                <Box className="flex-1 px-6 overflow-y-auto custom-scrollbar pb-6">
                    {children}
                </Box>
            </SheetContent>
        </Sheet>
    );
});

DetailPanel.displayName = 'DetailPanel';
