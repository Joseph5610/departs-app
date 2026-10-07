import React, { useRef, useState, memo } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
import { useIsMobile } from '@/hooks/useIsMobile';

import { ScrollArea } from '@/components/ui/scroll-area';
import { DRAWER_SNAP } from '@/config/constants';

interface DetailPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onBack?: () => void;
    title?: React.ReactNode;
    platformCode?: string;
    id?: string;
    subHeader?: React.ReactNode;
    /** Buttons shown left of the close button; a stop shows its own in the sub-header instead. */
    actions?: React.ReactNode;
    /** Each change collapses the mobile drawer to its lowest snap point. */
    collapseRequest?: number;
    children: React.ReactNode;
}

/**
 * DetailPanel
 *
 * Responsive panel for displaying stop and vehicle details.
 * Uses a sidebar (Sheet) on desktop and a bottom drawer (Base UI) on mobile.
 */
export const DetailPanel = memo(({ isOpen, onClose, onBack, title, id, platformCode, subHeader, actions, collapseRequest, children }: DetailPanelProps) => {
    const isMobile = useIsMobile();
    const { t } = useTranslation();

    const backButton = onBack && (
        <Button
            variant="ghost"
            size="icon-sm"
            onClick={onBack}
            aria-label={t('common.back')}
            className="shrink-0 -ml-2 text-muted-foreground"
        >
            <ArrowLeft size={20}  strokeWidth={1.5} />
        </Button>
    );

    const platformBadge = platformCode && (
        <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-foreground text-background text-[13px] font-bold tabular-nums mr-1.5 shadow-sm">
            {platformCode}
        </span>
    );

    // A clamp on the title element itself clips a badge taller than one text line in Safari.
    const clampedTitle = typeof title === 'string' ? <span className="min-w-0 line-clamp-2">{title}</span> : title;

    const titleElement = isMobile ? (
        <DrawerTitle className="min-w-0 flex-1 text-xl font-semibold text-foreground tracking-tight leading-tight">
            {clampedTitle}
        </DrawerTitle>
    ) : (
        <SheetTitle className="min-w-0 flex-1 text-xl font-semibold text-foreground tracking-tight text-left leading-tight">
            {clampedTitle}
        </SheetTitle>
    );

    const closeButton = (
        <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label={t('common.close')}
            data-testid="detail-panel-close"
            className="shrink-0 -mr-2 text-muted-foreground"
        >
            <X size={20} strokeWidth={1.5}  />
        </Button>
    );

    const headerContent = (
        <div className="flex w-full items-center justify-between pt-2">
            <div className="flex gap-1 min-w-0 flex-1 items-center">
                {backButton}
                {platformBadge}
                {titleElement}
            </div>
            {actions}
            {closeButton}
        </div>
    );

    const [activeSnapPoint, setActiveSnapPoint] = useState<number | string | null>(DRAWER_SNAP.DEFAULT);

    const swipeCloseFromRef = useRef<number | string | null>(null);
    const swipeCollapseRef = useRef(false);

    const [prevId, setPrevId] = useState(id);
    if (id !== prevId) {
        setPrevId(id);
        setActiveSnapPoint(DRAWER_SNAP.DEFAULT);
    }

    const [prevCollapseRequest, setPrevCollapseRequest] = useState(collapseRequest);
    if (collapseRequest !== prevCollapseRequest) {
        setPrevCollapseRequest(collapseRequest);
        setActiveSnapPoint(DRAWER_SNAP.SNAP_POINTS[0]);
    }

    if (isMobile) {
        return (
            <Drawer
                open={isOpen}
                onOpenChange={(open, details) => {
                    if (open || details.reason === 'outside-press' || details.reason === 'focus-out') return;
                    // A swipe-close from above the lowest snap point collapses instead; only the lowest one dismisses.
                    if (details.reason === 'swipe' && swipeCloseFromRef.current !== DRAWER_SNAP.SNAP_POINTS[0]) {
                        details.cancel();
                        swipeCollapseRef.current = true;
                        return;
                    }
                    onClose();
                }}
                snapPoints={DRAWER_SNAP.SNAP_POINTS}
                snapPoint={activeSnapPoint}
                onSnapPointChange={(snapPoint, details) => {
                    if (snapPoint === null && details.reason === 'swipe') swipeCloseFromRef.current = activeSnapPoint;
                    // A canceled swipe-close restores the previous snap point right after onOpenChange.
                    if (swipeCollapseRef.current && snapPoint !== null) {
                        swipeCollapseRef.current = false;
                        setActiveSnapPoint(DRAWER_SNAP.SNAP_POINTS[0]);
                        return;
                    }
                    setActiveSnapPoint(snapPoint);
                }}
                modal={false}
                disablePointerDismissal={true}
            >
                <DrawerContent
                    variant="glassy"
                    className="outline-none text-foreground"
                    initialFocus={false}
                    aria-describedby={undefined}
                    data-testid="detail-panel"
                    header={
                        <div className="shrink-0 flex flex-col">
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
                    }
                >
                    <div className="flex-1 min-h-0 overflow-y-auto px-6 overscroll-contain custom-scrollbar">
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
                // Only Escape closes from here: pointer dismissal is disabled, so outside-press and focus-out are ignored.
                if (!open && details.reason !== 'outside-press' && details.reason !== 'focus-out') {
                    onClose();
                }
            }}
            modal={false}
            disablePointerDismissal={true}
        >
            <SheetContent
                side="left"
                variant="glassy"
                showCloseButton={false}
                hideOverlay={true}
                className="w-(--sidebar-width) sm:max-w-(--sidebar-width) top-(--sidebar-inset)! left-(--sidebar-inset)! bottom-(--sidebar-inset)! h-[calc(100dvh-2*var(--sidebar-inset))]! p-0 gap-2 overflow-hidden flex flex-col outline-none rounded-3xl text-foreground"
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
