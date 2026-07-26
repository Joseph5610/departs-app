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
import { usePreferencesStore } from '../../../state/preferencesStore';
import { toast } from 'sonner';

export const MCP_ENDPOINT_URL = "https://departs.app/mcp";

export const McpModal: React.FC = () => {
    const { t } = useTranslation();
    const isOpen = usePreferencesStore(s => s.isMcpModalOpen);
    const { setIsMcpModalOpen } = usePreferencesStore(s => s.actions);

    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const handleCopy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        toast.success(t('mcp.copySuccess'));
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
                        <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-muted/40 border border-border/50">
                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                                {t('mcp.endpointLabel')}
                            </span>
                            <div className="flex items-center justify-between gap-2">
                                <code className="text-xs font-mono text-primary font-semibold select-all">
                                    {MCP_ENDPOINT_URL}
                                </code>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 gap-1.5 text-xs font-semibold shrink-0"
                                    onClick={() => handleCopy(MCP_ENDPOINT_URL, 'endpoint')}
                                >
                                    {copiedKey === 'endpoint' ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                                    <span>{t('mcp.copyUrl')}</span>
                                </Button>
                            </div>
                        </div>

                        {/* Guides List */}
                        <div className="flex flex-col gap-4">
                            {/* 1. Claude Desktop GUI */}
                            <div className="flex flex-col gap-2 p-4 rounded-xl border border-border/40 bg-card/50">
                                <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                                    <Laptop className="size-4 text-primary" />
                                    <span>{t('mcp.claudeDesktopTitle')} (GUI)</span>
                                </div>
                                <ol className="text-xs text-muted-foreground leading-relaxed list-decimal list-inside space-y-1">
                                    <li>{t('mcp.claudeDesktopStep1')}</li>
                                    <li>{t('mcp.claudeDesktopStep2')}</li>
                                    <li>{t('mcp.claudeDesktopStep3')}</li>
                                </ol>
                            </div>

                            {/* 2. Claude Code CLI */}
                            <div className="flex flex-col gap-2 p-4 rounded-xl border border-border/40 bg-card/50">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                                        <Terminal className="size-4 text-primary" />
                                        <span>{t('mcp.claudeCodeTitle')}</span>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 text-xs"
                                        onClick={() => handleCopy(`claude mcp add --transport sse departs ${MCP_ENDPOINT_URL}`, 'claudeCode')}
                                    >
                                        {copiedKey === 'claudeCode' ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                                    </Button>
                                </div>
                                <pre className="p-2.5 rounded-lg bg-black/40 text-[11px] font-mono text-muted-foreground overflow-x-auto select-all">
                                    claude mcp add --transport sse departs {MCP_ENDPOINT_URL}
                                </pre>
                            </div>

                            {/* 3. Cursor & Windsurf */}
                            <div className="flex flex-col gap-2 p-4 rounded-xl border border-border/40 bg-card/50">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                                        <Code2 className="size-4 text-primary" />
                                        <span>{t('mcp.cursorTitle')}</span>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 text-xs"
                                        onClick={() => handleCopy(JSON.stringify({ mcpServers: { departs: { command: "npx", args: ["-y", "mcp-remote", MCP_ENDPOINT_URL] } } }, null, 2), 'cursor')}
                                    >
                                        {copiedKey === 'cursor' ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                                    </Button>
                                </div>
                                <pre className="p-2.5 rounded-lg bg-black/40 text-[11px] font-mono text-muted-foreground overflow-x-auto select-all">
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
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};

McpModal.displayName = 'McpModal';
