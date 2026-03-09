import React, { useState, useEffect } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { MOBILE_BREAKPOINT } from '../../config/constants';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
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
 * Re-architected with semantic components for the header.
 * Updated with snap points for mobile bottom sheet.
 * Fixed UI freeze by removing controlled activeSnapPoint and simplified configuration.
 */
export const DetailPanel: React.FC<DetailPanelProps> = React.memo(({ isOpen, onClose, onBack, title, platformCode, children }) => {
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false);
    const [snap, setSnap] = useState<string | number | null>(0.4);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const headerContent = (
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
    );

    if (isMobile) {
        return (
            <Drawer
                open={isOpen}
                onOpenChange={(open) => !open && onClose()}
                dismissible={true}
                snapPoints={[120, 0.4, 0.95]}
                activeSnapPoint={snap}
                setActiveSnapPoint={setSnap}
                modal={false}
            >
                <DrawerContent className="bg-background/95 backdrop-blur-xl border-border !rounded-t-3xl overflow-hidden shadow-[0_-8px_30px_rgb(0,0,0,0.12)]">
                    <DrawerHeader className="px-6 pt-2 pb-2 text-left shrink-0">
                        <DrawerTitle>
                            {headerContent}
                        </DrawerTitle>
                    </DrawerHeader>
                    <Box className="flex-1 px-6 overflow-y-auto custom-scrollbar pb-[env(safe-area-inset-bottom,1.5rem)]">
                        {children}
                    </Box>
                </DrawerContent>
            </Drawer>
        );
    }

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent
                side="left"
                showCloseButton={false}
                className="w-[420px] sm:max-w-[420px] top-4 left-4 bottom-4 h-auto rounded-3xl border-border bg-background/95 backdrop-blur-2xl shadow-2xl p-0 overflow-hidden flex flex-col outline-none"
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
