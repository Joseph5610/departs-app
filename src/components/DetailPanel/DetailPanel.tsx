import React, { memo } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
    /** Mobile only: shown in the sheet while no panel is open; told whether the sheet is at full height. */
    home?: (isFull: boolean, isPeek: boolean) => React.ReactNode;
    /** Mobile only: the height the panel opens at least at. */
    minSnap?: 'half' | 'full';
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
export const DetailPanel = memo(({ isOpen, onClose, onBack, title, id, platformCode, subHeader, actions, collapseRequest, floating, homeHeader, home, minSnap = 'half', selfScrolling, children }: DetailPanelProps) => {
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
        <PlatformCircle code={platformCode} size="lg" className="mr-1.5" />
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

    if (isMobile) {
        return (
            <MobileSheet
                isOpen={isOpen}
                cardKey={isOpen ? id ?? 'panel' : null}
                minSnap={minSnap}
                collapseRequest={collapseRequest}
                header={headerContent}
                subHeader={subHeader}
                selfScrolling={selfScrolling}
                homeHeader={homeHeader}
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
                className="w-(--sidebar-width) sm:max-w-(--sidebar-width) top-(--sidebar-inset)! left-(--sidebar-inset)! bottom-(--sidebar-inset)! h-[calc(100dvh-2*var(--sidebar-inset))]! p-0 gap-2 overflow-hidden flex flex-col outline-none rounded-3xl text-foreground"
                aria-describedby={undefined}
                // The panel sits beside the map, not over it: focusing its first button would also pop that button's tooltip.
                initialFocus={false}
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
