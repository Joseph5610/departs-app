import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { usePreferencesStore } from '../../../state/preferencesStore';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DisplaySection } from './DisplaySection';
import { SettingsFooter } from './SettingsFooter';

export const SettingsModal: React.FC = () => {
    const { t, i18n } = useTranslation();

    // Preferences
    const isOpen = usePreferencesStore(s => s.isSettingsOpen);
    const { setIsSettingsOpen, setIsMcpModalOpen } = usePreferencesStore(s => s.actions);

    const onClose = React.useCallback(() => {
        setIsSettingsOpen(false);
    }, [setIsSettingsOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent aria-describedby={undefined} variant="default" data-testid="settings-modal-content">
                <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
                    <DialogTitle>
                        {t('settings.title')}
                    </DialogTitle>
                </DialogHeader>
                <ScrollArea className="flex-1 min-h-0 px-6">
                    <div className="flex flex-col gap-8 py-2 pb-8">
                        {/* AI Copilot & Remote MCP (Top Highlight) */}
                        <div className="flex flex-col gap-3">
                            <h3 className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest px-1">
                                {t('settings.sections.ai')}
                            </h3>
                            <button
                                onClick={() => { setIsSettingsOpen(false); setTimeout(() => setIsMcpModalOpen(true), 150); }}
                                className="w-full text-left p-4 rounded-2xl bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors flex items-start gap-3.5 group"
                            >
                                <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5">
                                    <Sparkles size={18} strokeWidth={2} className="animate-pulse" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors block">
                                        {t('mcp.title')}
                                    </span>
                                    <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                                        {t('mcp.subtitle')}
                                    </p>
                                </div>
                            </button>
                        </div>

                        {/* Display Toggles & Vehicle Type Filters */}
                        <DisplaySection />

                        {/* Language Selection */}
                        <div className="flex flex-col gap-3">
                            <h3 className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest px-1">
                                {t('settings.sections.language')}
                            </h3>
                            <ToggleGroup
                                value={[(i18n.resolvedLanguage || i18n.language).split('-')[0]]}
                                onValueChange={(val: string[]) => {
                                    if (val && val.length > 0) {
                                        i18n.changeLanguage(val[0]);
                                    }
                                }}
                                className="grid grid-cols-2 gap-3 bg-transparent p-0"
                            >
                                {(['en', 'cs'] as const).map((lang) => (
                                    <ToggleGroupItem
                                        key={lang}
                                        value={lang}
                                        variant="outline"
                                        className={cn(
                                            "h-auto py-3 px-4 rounded-xl text-sm font-semibold border-border/50",
                                            "data-[state=on]:ring-1 data-[state=on]:ring-inset data-[state=on]:ring-primary/40 data-[state=on]:text-primary data-[state=on]:border-primary/20 data-[state=on]:bg-primary/5",
                                            "data-[state=off]:text-muted-foreground data-[state=off]:bg-muted/40 data-[state=off]:backdrop-blur-md"
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-base">{lang === 'en' ? '🇬🇧' : '🇨🇿'}</span>
                                            <span>{t(`settings.language.${lang}`)}</span>
                                        </div>
                                    </ToggleGroupItem>
                                ))}
                            </ToggleGroup>
                        </div>


                        {/* Footer: Clear History, Update Check, External Links */}
                        <SettingsFooter />
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};
