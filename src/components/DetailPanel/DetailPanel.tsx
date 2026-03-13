import React, { useState, useEffect } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { MOBILE_BREAKPOINT } from '../../config/constants';
import {
    Drawer,
    DrawerContent,
    DrawerTitle,
    DrawerHandle,
} from '@/components/ui/drawer';
import {
    Sheet,
    SheetContent,
    SheetTitle,
} from '@/components/ui/sheet';
import type { DialogRootChangeEventDetails } from '@base-ui/react';
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
 * Responsive panel for displaying stop and vehicle details.
 * Uses a sidebar (Sheet) on desktop and a bottom drawer (vaul) on mobile.
 */
export const DetailPanel: React.FC<DetailPanelProps> = React.memo(({ isOpen, onClose, onBack, title, platformCode, children }) => {
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false);
    const [snap, setSnap] = useState<string | number | null>(0.5);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const titleContent = (
        <HStack className="gap-2 min-w-0 flex-1">
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
            <HStack className="gap-2 min-w-0 flex-1">
                {isMobile ? (
                    <DrawerTitle className="text-xl font-bold text-foreground truncate tracking-tight">
                        {title || ''}
                    </DrawerTitle>
                ) : (
                    <SheetTitle className="text-xl font-bold text-foreground truncate tracking-tight">
                        {title || ''}
                    </SheetTitle>
                )}
                {platformCode && (
                    <Box className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-muted border border-border text-muted-foreground text-[13px] font-black tabular-nums">
                        {platformCode}
                    </Box>
                )}
            </HStack>
        </HStack>
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
                snapPoints={[0.5, 1]}
                activeSnapPoint={snap}
                setActiveSnapPoint={setSnap}
                dismissible={true}
                handleOnly={true}
                shouldScaleBackground={false}
            >
                <DrawerContent
                    className="glassy-surface !rounded-t-3xl border-none shadow-2xl h-full data-[vaul-drawer-direction=bottom]:max-h-[96dvh]"
                    showHandle={false}
                >
                    <div className="flex flex-col h-full min-h-0 overflow-hidden relative">
                        <DrawerHandle className="flex flex-col shrink-0 cursor-grab active:cursor-grabbing">
                            <div className="mx-auto mt-4 h-1.5 w-12 shrink-0 rounded-full bg-muted mb-2" />
                            <Box className="px-6 pb-4">
                                {titleContent}
                            </Box>
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
                className="w-[420px] sm:max-w-[420px] !top-5 !left-5 !bottom-5 !h-auto rounded-3xl glassy-surface p-0 overflow-hidden flex flex-col outline-none border-none shadow-2xl"
            >
                <div className="px-6 pt-6 pb-2 shrink-0">
                    <HStack className="justify-between w-full">
                        {titleContent}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="shrink-0 -mr-2 h-10 w-10 text-muted-foreground hover:text-foreground"
                        >
                            <X size={20} />
                        </Button>
                    </HStack>
                </div>
                <Box className="flex-1 px-6 overflow-y-auto custom-scrollbar pb-6">
                    {children}
                </Box>
            </SheetContent>
        </Sheet>
    );
});

DetailPanel.displayName = 'DetailPanel';
