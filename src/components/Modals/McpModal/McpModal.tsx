import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Copy, Check, Terminal, Laptop, Code2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePreferencesStore } from '../../../state/preferencesStore';
import { toast } from 'sonner';

export const MCP_ENDPOINT_URL = "https://departs.app/mcp";

export const McpModal: React.FC = () => {
    const { t } = useTranslation();
    const isOpen = usePreferencesStore(s => s.isMcpModalOpen);
    const { setIsMcpModalOpen } = usePreferencesStore(s => s.actions);

    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const handleCopy = (text: string, key: string, toastMsgKey: string = 'mcp.copySuccess') => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        toast.success(t(toastMsgKey));
        setTimeout(() => setCopiedKey(null), 2000);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && setIsMcpModalOpen(false)}>
            <DialogContent aria-describedby={undefined} variant="default" className="max-w-xl">
                <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                        <Sparkles className="size-5 text-primary animate-pulse" />
                        <span>{t('mcp.title')}</span>
                    </DialogTitle>
                </DialogHeader>
                <ScrollArea className="flex-1 min-h-0 px-6">
                    <div className="flex flex-col gap-6 py-2 pb-6">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {t('mcp.subtitle')}
                        </p>

                        {/* Endpoint URL Box */}
                        <Card variant="subtle" size="none">
                            <div className="p-4 flex flex-col gap-2">
                                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                                    {t('mcp.endpointLabel')}
                                </span>
                                <div className="flex items-center justify-between gap-2">
                                    <code className="text-xs font-mono text-primary font-semibold select-all break-all">
                                        {MCP_ENDPOINT_URL}
                                    </code>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 gap-1.5 text-xs font-semibold shrink-0 cursor-pointer"
                                        onClick={() => handleCopy(MCP_ENDPOINT_URL, 'endpoint')}
                                    >
                                        {copiedKey === 'endpoint' ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                                        <span>{t('mcp.copyUrl')}</span>
                                    </Button>
                                </div>
                            </div>
                        </Card>

                        {/* Guides List */}
                        <div className="flex flex-col gap-4">
                            {/* 1. Claude Desktop GUI */}
                            <Card variant="subtle" size="none">
                                <div className="p-4 flex flex-col gap-2.5">
                                    <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                                            <Laptop className="size-4" />
                                        </div>
                                        <span>{t('mcp.claudeDesktopTitle')} (GUI)</span>
                                    </div>
                                    <ol className="text-xs text-muted-foreground leading-relaxed list-decimal list-inside space-y-1 pl-1">
                                        <li>{t('mcp.claudeDesktopStep1')}</li>
                                        <li>{t('mcp.claudeDesktopStep2')}</li>
                                        <li>{t('mcp.claudeDesktopStep3')}</li>
                                    </ol>
                                </div>
                            </Card>

                            {/* 2. Claude Code CLI */}
                            <Card variant="subtle" size="none">
                                <div className="p-4 flex flex-col gap-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                                            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                                                <Terminal className="size-4" />
                                            </div>
                                            <span>{t('mcp.claudeCodeTitle')}</span>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 px-2.5 text-xs font-semibold gap-1.5 cursor-pointer"
                                            onClick={() => handleCopy(`claude mcp add --transport sse departs ${MCP_ENDPOINT_URL}`, 'claudeCode', 'mcp.copyCommandSuccess')}
                                        >
                                            {copiedKey === 'claudeCode' ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                                            <span className="sr-only sm:not-sr-only">Copy</span>
                                        </Button>
                                    </div>
                                    <pre className="p-3 rounded-xl bg-muted/60 dark:bg-black/40 border border-border/50 text-[11px] font-mono text-foreground leading-relaxed overflow-x-auto select-all">
                                        claude mcp add --transport sse departs {MCP_ENDPOINT_URL}
                                    </pre>
                                </div>
                            </Card>

                            {/* 3. Cursor & Windsurf */}
                            <Card variant="subtle" size="none">
                                <div className="p-4 flex flex-col gap-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                                            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                                                <Code2 className="size-4" />
                                            </div>
                                            <span>{t('mcp.cursorTitle')}</span>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 px-2.5 text-xs font-semibold gap-1.5 cursor-pointer"
                                            onClick={() => handleCopy(JSON.stringify({ mcpServers: { departs: { command: "npx", args: ["-y", "mcp-remote", MCP_ENDPOINT_URL] } } }, null, 2), 'cursor', 'mcp.copyConfigSuccess')}
                                        >
                                            {copiedKey === 'cursor' ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                                            <span className="sr-only sm:not-sr-only">Copy</span>
                                        </Button>
                                    </div>
                                    <pre className="p-3 rounded-xl bg-muted/60 dark:bg-black/40 border border-border/50 text-[11px] font-mono text-foreground leading-relaxed overflow-x-auto select-all">
                                        {JSON.stringify({
                                            mcpServers: {
                                                departs: {
                                                    command: "npx",
                                                    args: ["-y", "mcp-remote", MCP_ENDPOINT_URL]
                                                }
                                            }
                                        }, null, 2)}
                                    </pre>
                                </div>
                            </Card>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};

McpModal.displayName = 'McpModal';
