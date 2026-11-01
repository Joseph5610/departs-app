import React, { memo } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { DrawerTitle } from '@/components/ui/drawer';
import {
    Sheet,
    SheetContent,
    SheetTitle,
    type DialogRootChangeEventDetails
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { PlatformCircle } from '@/components/PlatformCircle';
import { useIsMobile } from '@/hooks/useIsMobile';

import { ScrollArea } from '@/components/ui/scroll-area';
import { MobileSheet } from './MobileSheet';
import { SidebarResizeHandle } from './SidebarResizeHandle';

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
    /** Each change collapses the mobile sheet to its peek. */
    collapseRequest?: number;
    /** Mobile only: rides above the sheet's top edge, hidden while the sheet is fully open. */
    floating?: (hidden: boolean) => React.ReactNode;
    /** Mobile only: the home's top row, in the sheet header while no panel is open. */
    homeHeader?: React.ReactNode;
    /** The phone's bottom toolbar of a card, told whether scrolling folded it. */
    toolbar?: (collapsed: boolean) => React.ReactNode;
    /** Mobile only: shown in the sheet while no panel is open; told whether the sheet is at full height and whether at its peek. */
    home?: (isFull: boolean, isPeek: boolean) => React.ReactNode;
    /** Mobile only: the height the panel opens at least at. */
    minSnap?: 'half' | 'full';
    /** The phone's card opens exactly at half, as its content is short. */
    opensAtHalf?: boolean;
    /** Mobile only: the content brings its own scroll container. */
    selfScrolling?: boolean;
    children: React.ReactNode;
}

/**
 * DetailPanel
 *
 * Responsive panel for displaying stop and vehicle details.
 * Uses a sidebar (Sheet) on desktop; on mobile, the one bottom sheet that also holds the home content.
 */
export const DetailPanel = memo(({ isOpen, onClose, onBack, title, id, platformCode, subHeader, actions, opensAtHalf, collapseRequest, floating, homeHeader, toolbar, home, minSnap = 'half', selfScrolling, children }: DetailPanelProps) => {
    const isMobile = useIsMobile();
    const { t } = useTranslation();

    const backButton = onBack && (
        <Button
            variant="secondary"
            size="icon-xs"
            onClick={onBack}
            aria-label={t('common.back')}
            className="shrink-0 text-muted-foreground"
        >
            <ChevronLeft strokeWidth={2.5} className="size-4" />
        </Button>
    );

    const platformBadge = platformCode && (
        <PlatformCircle code={platformCode} size="title" />
    );

    const titleText = typeof title === 'string' ? <span className="block min-w-0 truncate">{title}</span> : title;

    const titleElement = isMobile ? (
        <DrawerTitle className="min-w-0 flex-1 type-title text-foreground">
            {titleText}
        </DrawerTitle>
    ) : (
        <SheetTitle className="min-w-0 flex-1 type-title text-foreground text-left">
            {titleText}
        </SheetTitle>
    );

    const closeButton = (
        <Button
            variant="secondary"
            size="icon-xs"
            onClick={onClose}
            aria-label={t('common.close')}
            data-testid="detail-panel-close"
            className="shrink-0 text-muted-foreground"
        >
            <X strokeWidth={2.5} className="size-3.5" />
        </Button>
    );

    const headerContent = (
        <div className={cn("flex w-full items-center justify-between gap-2.5", isMobile ? "pt-1.5 pb-3.5" : "pt-2")}>
            <div className="flex gap-2.5 min-w-0 flex-1 items-center">
                {backButton}
                {platformBadge}
                {titleElement}
            </div>
            {actions && <div className="flex shrink-0 items-center">{actions}</div>}
            {closeButton}
        </div>
    );

    if (isMobile) {
        return (
            <MobileSheet
                isOpen={isOpen}
                cardKey={isOpen ? id ?? 'panel' : null}
                minSnap={minSnap}
                opensAtHalf={opensAtHalf}
                collapseRequest={collapseRequest}
                header={headerContent}
                subHeader={subHeader}
                selfScrolling={selfScrolling}
                homeHeader={homeHeader}
                toolbar={toolbar}
                home={home}
                floating={floating}
                onDismiss={onClose}
            >
                {children}
            </MobileSheet>
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
                className="data-[side=left]:w-(--sidebar-width) data-[side=left]:sm:max-w-(--sidebar-width) top-(--sidebar-inset)! left-(--sidebar-inset)! bottom-(--sidebar-inset)! h-[calc(100dvh-2*var(--sidebar-inset))]! p-0 gap-2 flex flex-col outline-none rounded-sheet text-foreground"
                aria-describedby={undefined}
                // The panel sits beside the map, not over it: focusing its first button would also pop that button's tooltip.
                initialFocus={false}
                data-testid="detail-panel"
            >
                {/* Clips the content to the rounded-badge panel; the resize handle outside it reaches past the edge. */}
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden rounded-[inherit]">
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
                    <ScrollArea className="flex-1 min-h-0 pb-6">
                        <div className="px-(--panel-gutter)">{children}</div>
                    </ScrollArea>
                </div>
                <SidebarResizeHandle />
            </SheetContent>
        </Sheet>
    );
});

DetailPanel.displayName = 'DetailPanel';
