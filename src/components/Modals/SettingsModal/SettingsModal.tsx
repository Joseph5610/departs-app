import { useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Item, ItemActions, ItemMedia } from '@/components/ui/item';
import { SectionHeading } from '@/components/SectionHeading';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useUiStore } from '@/state/uiStore';
import { ChevronRight, Sparkles } from 'lucide-react';
import { DisplaySection } from './DisplaySection';
import { NotificationsSection } from './NotificationsSection';
import { RowText } from './SettingsControls';
import { SettingsFooter } from './SettingsFooter';
import { SUPPORTED_LANGUAGES } from '@/i18n/config';
import { UI_TIMING_MS } from '@/config/constants';
import { useIsMobile } from '@/hooks/useIsMobile';

/** The settings themselves: the body of the settings dialog and of the mobile settings card. */
export const SettingsContent = () => {
    const { t, i18n } = useTranslation();
    const { setIsSettingsOpen, setIsMcpModalOpen } = useUiStore(s => s.actions);

    return (
        <div className="flex flex-col gap-5 pt-1 pb-8">
            <NotificationsSection />

            <DisplaySection />

            <section className="flex flex-col gap-2">
                <SectionHeading>{t('settings.sections.language')}</SectionHeading>
                <SegmentedControl
                    fill
                    value={i18n.resolvedLanguage ?? ''}
                    onChange={(language) => i18n.changeLanguage(language)}
                    options={SUPPORTED_LANGUAGES.map(language => ({ value: language, label: t(`settings.language.${language}`) }))}
                />
            </section>

            <section className="flex flex-col gap-2">
                <SectionHeading>{t('settings.sections.ai')}</SectionHeading>
                <Card size="none">
                    <Item
                        variant="row"
                        size="none"
                        render={<button onClick={() => { setIsSettingsOpen(false); setTimeout(() => setIsMcpModalOpen(true), UI_TIMING_MS.MODAL_SWAP_DELAY); }} />}
                    >
                        <ItemMedia variant="rowIcon" className="text-muted-foreground"><Sparkles strokeWidth={1.75} /></ItemMedia>
                        <RowText title={t('mcp.title')} description={t('mcp.subtitle')} />
                        <ItemActions><ChevronRight size={17} strokeWidth={1.75} className="text-label-3" /></ItemActions>
                    </Item>
                </Card>
            </section>

            <SettingsFooter />
        </div>
    );
};

/** The settings dialog on desktop; phones show {@link SettingsContent} as a card in the sheet. */
export const SettingsModal = memo(() => {
    const { t } = useTranslation();

    // Stays mounted once opened, so a window narrowed to a phone's width must not reopen it beside the sheet's card.
    const isMobile = useIsMobile();
    const isOpen = useUiStore(s => s.isSettingsOpen) && !isMobile;
    const { setIsSettingsOpen } = useUiStore(s => s.actions);

    const onClose = useCallback(() => {
        setIsSettingsOpen(false);
    }, [setIsSettingsOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent aria-describedby={undefined} data-testid="settings-modal-content">
                <DialogHeader className="px-(--panel-gutter) pt-6 pb-2 shrink-0">
                    <DialogTitle>
                        {t('settings.title')}
                    </DialogTitle>
                </DialogHeader>
                <ScrollArea className="flex-1 min-h-0 px-(--panel-gutter)">
                    <SettingsContent />
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
});

SettingsModal.displayName = 'SettingsModal';
