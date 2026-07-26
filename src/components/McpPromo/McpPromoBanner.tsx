import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Copy, Check, X, Info } from 'lucide-react';
import { usePreferencesStore } from '../../state/preferencesStore';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { MCP_ENDPOINT_URL } from '../Modals/McpModal/McpModal';

export const McpPromoBanner: React.FC = () => {
    const { t } = useTranslation();
    const isDismissed = usePreferencesStore(s => s.isMcpBannerDismissed);
    const { setIsMcpBannerDismissed, setIsMcpModalOpen } = usePreferencesStore(s => s.actions);

    const [isCopied, setIsCopied] = useState(false);

    if (isDismissed) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(MCP_ENDPOINT_URL);
        setIsCopied(true);
        toast.success(t('mcp.copySuccess'));
        setTimeout(() => setIsCopied(false), 2000);
    };

    return (
        <div className="hidden md:block fixed bottom-20 left-1/2 -translate-x-1/2 z-40 max-w-md w-[calc(100%-2rem)] px-4 py-3 rounded-2xl bg-background/90 backdrop-blur-xl border border-primary/30 shadow-2xl shadow-primary/10 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 shrink-0 pt-0.5">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                        <Sparkles className="size-4 animate-pulse" />
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <span>{t('mcp.bannerTitle')}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">
                            {t('mcp.newBadge')}
                        </span>
                    </h4>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">
                        {t('mcp.bannerDesc')}
                    </p>

                    <div className="flex items-center gap-2 mt-2.5">
                        <Button
                            size="sm"
                            variant="default"
                            className="h-7 px-2.5 text-[11px] font-semibold gap-1 rounded-lg"
                            onClick={handleCopy}
                        >
                            {isCopied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                            <span>{t('mcp.copyUrl')}</span>
                        </Button>

                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-[11px] font-semibold gap-1 rounded-lg border-border/60"
                            onClick={() => setIsMcpModalOpen(true)}
                        >
                            <Info className="size-3" />
                            <span>{t('mcp.learnMore')}</span>
                        </Button>
                    </div>
                </div>

                <button
                    onClick={() => setIsMcpBannerDismissed(true)}
                    className="shrink-0 p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                    aria-label="Dismiss banner"
                >
                    <X className="size-4" />
                </button>
            </div>
        </div>
    );
};

McpPromoBanner.displayName = 'McpPromoBanner';
