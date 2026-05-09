import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePreferences } from '../../../state/contexts';
import { cn } from '@/lib/utils';
import { Box, Stack } from '@/components/ui/layout';
import { DisplaySection } from './DisplaySection';
import { SettingsFooter } from './SettingsFooter';

/**
 * SettingsModal
 *
 * Container component that composes DisplaySection and SettingsFooter.
 * Manages dialog open/close state and language selection.
 */
export const SettingsModal: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { state, actions } = usePreferences();

    const { isSettingsOpen: isOpen } = state;
    const { setIsSettingsOpen } = actions;

    const onClose = React.useCallback(() => {
        setIsSettingsOpen(false);
    }, [setIsSettingsOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent aria-describedby={undefined} variant="tinted" data-testid="settings-modal-content" className="flex flex-col h-[calc(100dvh-5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] p-0 overflow-hidden gap-0">
                <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
                    <DialogTitle>
                        {t('settings.title')}
                    </DialogTitle>
                </DialogHeader>
                <ScrollArea className="flex-1 min-h-0 px-6">
                    <Stack gap={8} className="py-2 pb-8">
                        {/* Display Toggles & Vehicle Type Filters */}
                        <DisplaySection />

                        {/* Language Selection */}
                        <Stack gap={3}>
                            <h3 className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest px-1">
                                {t('settings.sections.language')}
                            </h3>
                            <Box className="grid grid-cols-2 gap-3">
                                {(['en', 'cs'] as const).map((lang) => (
                                    <button
                                        key={lang}
                                        onClick={() => i18n.changeLanguage(lang)}
                                        className={cn(
                                            "py-3 px-4 rounded-2xl text-sm font-semibold outline-none glassy-tinted",
                                            (i18n.resolvedLanguage || i18n.language).startsWith(lang)
                                                ? "ring-1 ring-inset ring-primary/40 text-primary border-primary/20"
                                                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                                        )}
                                    >
                                        {t(`settings.language.${lang}`)}
                                    </button>
                                ))}
                            </Box>
                        </Stack>


                        {/* Footer: Clear History, Update Check, External Links */}
                        <SettingsFooter />
                    </Stack>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};
