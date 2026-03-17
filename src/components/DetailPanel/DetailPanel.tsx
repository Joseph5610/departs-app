import React, { useState, useEffect } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { MOBILE_BREAKPOINT } from '../../config/constants';
import {
    Drawer,
    DrawerContent,
    DrawerTitle,
    DrawerHeader,
    DrawerDescription,
} from '@/components/ui/drawer';
import {
    Sheet,
    SheetContent,
    SheetTitle,
} from '@/components/ui/sheet';
import type { DialogRootChangeEventDetails } from '@base-ui/react';
import { Button } from '@/components/ui/button';
import { Box, HStack } from '@/components/ui/layout';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

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

    const desktopTitleContent = (
        <HStack className="gap-2 min-w-0 flex-1">
            {backButton}
            <HStack className="gap-2 min-w-0 flex-1">
                <SheetTitle className="text-xl font-bold text-foreground truncate tracking-tight">
                    {title || ''}
                </SheetTitle>
                {platformBadge}
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
                snapPoints={[0.5, 0.9]}
                activeSnapPoint={snap}
                setActiveSnapPoint={setSnap}
                shouldScaleBackground={false}
                modal={false}
                dismissible={true}
            >
                <DrawerContent 
                    className="max-h-[96%] min-h-[50dvh] flex flex-col pointer-events-auto glassy-tinted border-white/20! outline-none"
                    hideOverlay={true}
                >
                    <DrawerHeader className="shrink-0 pointer-events-auto">
                        <DrawerTitle>{title || ''}</DrawerTitle>
                        <DrawerDescription>
                            {platformCode && `Platform ${platformCode}`}
                        </DrawerDescription>
                    </DrawerHeader>
                    <div 
                        vaul-no-drag 
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
                <Box padding="none" className="px-6 pt-6 pb-2 shrink-0">
                    <HStack justify="between" className="w-full">
                        <Box padding="none" className="min-w-0 flex-1 pr-4">
                            {desktopTitleContent}
                        </Box>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="shrink-0 rounded-full h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
                        >
                            <X size={20} />
                        </Button>
                    </HStack>
                </Box>
                <ScrollArea className="flex-1 min-h-0 px-6 pb-6">
                    {children}
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
});

DetailPanel.displayName = 'DetailPanel';
