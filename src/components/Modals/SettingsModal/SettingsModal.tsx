import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Info } from 'lucide-react';
import { usePreferences } from '../../../state/MapStateProvider';
import { cn } from '@/lib/utils';
import { Box, Stack, HStack } from '@/components/ui/layout';
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

    const { isSettingsOpen: isOpen, showVehicles, showStops, routeTypeFilter, searchHistory } = state;
    const { setIsSettingsOpen, setShowVehicles, setShowStops, setRouteTypeFilter, clearHistory } = actions;

    const onClose = React.useCallback(() => {
        setIsSettingsOpen(false);
    }, [setIsSettingsOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent variant="tinted" data-testid="settings-modal-content" className="flex flex-col h-[calc(100dvh-2.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] p-0 overflow-hidden gap-0">
                <DialogHeader className="px-6 pt-6 shrink-0">
                    <DialogTitle>
                        {t('settings.title')}
                    </DialogTitle>
                </DialogHeader>
                <ScrollArea className="flex-1 min-h-0 px-6">
                    <Stack gap={8} className="py-2 pb-8">
                        {/* Display Toggles & Vehicle Type Filters */}
                        <DisplaySection
                            showVehicles={showVehicles}
                            showStops={showStops}
                            routeTypeFilter={routeTypeFilter}
                            setShowVehicles={setShowVehicles}
                            setShowStops={setShowStops}
                            setRouteTypeFilter={setRouteTypeFilter}
                        />

                        {/* Language Selection */}
                        <Stack gap={3}>
                            <Box className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest px-1">
                                {t('settings.sections.language')}
                            </Box>
                            <Box className="grid grid-cols-2 gap-3">
                                {(['en', 'cs'] as const).map((lang) => (
                                    <button
                                        key={lang}
                                        onClick={() => i18n.changeLanguage(lang)}
                                        className={cn(
                                            "py-3 px-4 rounded-2xl text-sm font-semibold outline-none glassy-tinted",
                                            (i18n.resolvedLanguage || i18n.language).startsWith(lang)
                                                ? "ring-1 ring-primary/40 text-primary border-primary/20"
                                                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                                        )}
                                    >
                                        {t(`settings.language.${lang}`)}
                                    </button>
                                ))}
                            </Box>
                        </Stack>

                        {/* Tip Box */}
                        <HStack className="p-3.5 sm:p-4 bg-amber-500/10 rounded-2xl border border-amber-500/30 gap-2.5 sm:gap-3 items-start">
                            <Box className="shrink-0 text-amber-500/70 mt-0.5">
                                <Info size={16} />
                            </Box>
                            <Box className="text-foreground/90 text-xs leading-relaxed font-medium">
                                <span className="text-amber-200 font-bold">{t('settings.tip.prefix')}</span> {t('settings.tip.text')}
                            </Box>
                        </HStack>

                        {/* Footer: Clear History, Update Check, External Links */}
                        <SettingsFooter
                            searchHistory={searchHistory}
                            clearHistory={clearHistory}
                        />
                    </Stack>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};
