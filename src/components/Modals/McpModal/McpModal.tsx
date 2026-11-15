import { Item } from '@/components/ui/item';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { Code2, Laptop, Terminal, type LucideIcon } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { CopyButton } from '@/components/CopyButton';
import { SectionHeading } from '@/components/SectionHeading';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { useUiStore } from '@/state/uiStore';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { SITE } from '@/config/site';

const CLAUDE_CODE_COMMAND = `claude mcp add --transport sse departs ${SITE.MCP_URL}`;
const CURSOR_CONFIG = JSON.stringify({ mcpServers: { departs: { command: "npx", args: ["-y", "mcp-remote", SITE.MCP_URL] } } }, null, 2);

const McpRow = ({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: React.ReactNode }) => (
    <Item variant="row" size="none" className="min-h-12 after:hidden">
        <Icon size={20} strokeWidth={1.75} className="shrink-0 text-tint-mint" />
        <span className="min-w-0 flex-1 truncate type-row text-foreground">{title}</span>
        {children}
    </Item>
);

const McpCode = ({ children }: { children: React.ReactNode }) => (
    <div className="px-3.5 pb-3.5">
        <pre className="overflow-x-auto rounded-nested bg-fill p-3 font-mono type-meta text-muted-foreground select-all">{children}</pre>
    </div>
);

export const McpModal = () => {
    const { t } = useTranslation();
    const isOpen = useUiStore(s => s.isMcpModalOpen);
    const { setIsMcpModalOpen } = useUiStore(s => s.actions);

    const { copiedKey, copy } = useCopyToClipboard();

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && setIsMcpModalOpen(false)}>
            <DialogContent aria-describedby={undefined} phoneLayout="page" className="max-w-xl">
                <DialogHeader className="px-(--panel-gutter) pt-6 pb-2 shrink-0">
                    <DialogTitle>{t('mcp.title')}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="flex-1 min-h-0 px-(--panel-gutter)">
                    <div className="flex flex-col gap-5 pb-6">
                        <p className="type-meta text-muted-foreground">{t('mcp.subtitle')}</p>

                        <section className="flex flex-col gap-2">
                            <SectionHeading>{t('mcp.endpointLabel')}</SectionHeading>
                            <Card size="none">
                                <div className="flex min-h-12 items-center justify-between gap-2 px-3.5 py-2.5">
                                    <code className="min-w-0 truncate select-all font-mono type-meta text-tint-mint">{SITE.MCP_URL}</code>
                                    <CopyButton label={t('mcp.copyUrl')} copiedLabel={t('mcp.copied')} isCopied={copiedKey === 'endpoint'} onCopy={() => copy(SITE.MCP_URL, 'endpoint')} />
                                </div>
                            </Card>
                        </section>

                        <Card size="none">
                            <McpRow icon={Laptop} title={`${t('mcp.claudeDesktopTitle')} (GUI)`} />
                            <ol className="list-inside list-decimal space-y-1 px-3.5 pb-3.5 type-meta text-muted-foreground">
                                <li>{t('mcp.claudeDesktopStep1')}</li>
                                <li>{t('mcp.claudeDesktopStep2')}</li>
                                <li>{t('mcp.claudeDesktopStep3')}</li>
                            </ol>
                        </Card>

                        <Card size="none">
                            <McpRow icon={Terminal} title={t('mcp.claudeCodeTitle')}>
                                <CopyButton label={t('mcp.copy')} copiedLabel={t('mcp.copied')} isCopied={copiedKey === 'claudeCode'} onCopy={() => copy(CLAUDE_CODE_COMMAND, 'claudeCode')} />
                            </McpRow>
                            <McpCode>{CLAUDE_CODE_COMMAND}</McpCode>
                        </Card>

                        <Card size="none">
                            <McpRow icon={Code2} title={t('mcp.cursorTitle')}>
                                <CopyButton label={t('mcp.copy')} copiedLabel={t('mcp.copied')} isCopied={copiedKey === 'cursor'} onCopy={() => copy(CURSOR_CONFIG, 'cursor')} />
                            </McpRow>
                            <McpCode>{CURSOR_CONFIG}</McpCode>
                        </Card>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};
