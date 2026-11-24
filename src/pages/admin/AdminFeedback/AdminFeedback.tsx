import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertOctagon, Bug, ChevronLeft, Lightbulb, MessageSquare, Terminal, type LucideIcon } from 'lucide-react';
import type { StoredFeedback } from '@/types';
import { apiFetch } from '@/lib/apiClient';
import { cn } from '@/lib/cn';
import { formatTimeAgo } from '@/domain/time';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { useNowEvery } from '@/hooks/useNow';
import { UI_TIMING_MS } from '@/config/constants';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SearchField } from '@/components/SearchField';
import { SectionHeading } from '@/components/SectionHeading';
import { EmptyState } from '@/components/EmptyState';
import { CopyButton } from '@/components/CopyButton';
import { FactRow } from '@/components/FactRow';
import { ExpandChevron } from '@/components/Chevron';
import { AdminLayout } from '@/pages/admin/AdminLayout';
import { AdminStatus, JsonPanel, RefreshButton } from '@/pages/admin/AdminParts';
import { buildAgentPrompt } from './agentPrompt';
import { filterFeedback, type FeedbackKind } from './feedbackFilter';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TYPE_ICONS: Record<StoredFeedback['type'], { icon: LucideIcon; tone: string }> = {
    crash: { icon: AlertOctagon, tone: 'text-destructive' },
    bug: { icon: Bug, tone: 'text-destructive' },
    feature_request: { icon: Lightbulb, tone: 'text-tint-amber' },
    other: { icon: MessageSquare, tone: 'text-tint-sky' },
};

const typeLabel = (type: StoredFeedback['type']) => type.replace('_', ' ');

const TypeIcon = ({ type }: { type: StoredFeedback['type'] }) => {
    const { icon: Icon, tone } = TYPE_ICONS[type];
    return <Icon strokeWidth={1.75} className={tone} />;
};

/** A stack trace of a crash report under its heading. */
const StackBlock = ({ title, stack }: { title: string; stack?: string }) => stack ? (
    <section className="flex flex-col gap-2">
        <SectionHeading>{title}</SectionHeading>
        <Card size="none" className="bg-tint-red/16 p-4">
            <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs text-destructive">{stack}</pre>
        </Card>
    </section>
) : null;

const FeedbackDetail = ({ item, now, onBack }: { item: StoredFeedback; now: number; onBack: () => void }) => {
    const { copiedKey, copy } = useCopyToClipboard();
    const [showsDiagnostics, setShowsDiagnostics] = useState(false);
    const crash = item.type === 'crash' ? item.diagnostics?.crashInfo : undefined;
    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" className="gap-1 pl-2 lg:hidden" onClick={onBack}>
                    <ChevronLeft /> List
                </Button>
                <span className="flex items-center gap-2 [&_svg]:size-4.5"><TypeIcon type={item.type} /><SectionHeading>{typeLabel(item.type)}</SectionHeading></span>
                <span className="type-meta text-muted-foreground">{formatTimeAgo(item.timestamp, now, 'en')}</span>
                <span className="ml-auto flex gap-2">
                    <CopyButton label="Copy JSON" copiedLabel="Copied" isCopied={copiedKey === 'json'} onCopy={() => copy(JSON.stringify(item, null, 2), 'json')} />
                    <Button size="sm" className="gap-1.5 pl-2.5" onClick={() => copy(buildAgentPrompt(item), 'prompt')}>
                        <Terminal className="size-3.75" />
                        {copiedKey === 'prompt' ? 'Copied' : 'Copy agent prompt'}
                    </Button>
                </span>
            </div>

            <Card size="none" className="p-4">
                <p className="whitespace-pre-wrap type-row text-foreground">{item.message}</p>
            </Card>

            <StackBlock title="Error stack" stack={crash?.errorStack} />
            <StackBlock title="Component stack" stack={crash?.componentStack} />

            <Card size="none">
                <FactRow label="ID" value={<span className="font-mono type-meta">{item.id}</span>} />
                {item.email && <FactRow label="Email" value={item.email} />}
                {item.ipAddress && <FactRow label="IP" value={<span className="font-mono type-meta">{item.ipAddress}</span>} />}
                <FactRow label="Time" value={new Date(item.timestamp).toLocaleString()} />
            </Card>

            {item.diagnostics && (
                <Card size="none">
                    <Collapsible open={showsDiagnostics} onOpenChange={setShowsDiagnostics}>
                        <CollapsibleTrigger render={<Item variant="row" size="none" render={<button type="button" />} />}>
                            <ItemMedia variant="rowIcon"><Bug strokeWidth={1.75} /></ItemMedia>
                            <ItemContent><ItemTitle className="type-row text-foreground">Diagnostics</ItemTitle></ItemContent>
                            <ExpandChevron isOpen={showsDiagnostics} className="text-label-3" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="border-t border-sep p-4">
                            <JsonPanel data={item.diagnostics} shouldExpandNode={() => true} />
                        </CollapsibleContent>
                    </Collapsible>
                </Card>
            )}
        </div>
    );
};

export const AdminFeedback = () => {
    const [query, setQuery] = useState('');
    const [kind, setKind] = useState<FeedbackKind>('all');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showsDetail, setShowsDetail] = useState(false);
    const now = useNowEvery(UI_TIMING_MS.MINUTES_TICK);

    const { data, isLoading, error, refetch, isFetching } = useQuery<{ items: StoredFeedback[] }>({
        queryKey: ['adminFeedback'],
        queryFn: () => apiFetch<{ items: StoredFeedback[] }>('/admin/feedback'),
    });
    const items = data?.items ?? [];
    const shown = filterFeedback(items, kind, query);
    const selected = shown.find(item => item.id === selectedId) ?? shown[0];

    return (
        <AdminLayout title="Feedback Hub" headerActions={<RefreshButton onRefresh={() => refetch()} isRefreshing={isFetching} />}>
            {isLoading || error ? <AdminStatus error={error} onRetry={() => refetch()} /> : items.length === 0 ? (
                <EmptyState icon={MessageSquare} title="No feedback yet" description="Bug reports, requests and crashes show up here." />
            ) : (
                <>
                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
                        <SearchField value={query} onValueChange={setQuery} clearLabel="Clear" placeholder="Message, email, ID or IP" className="sm:flex-1" />
                        <Tabs value={kind} onValueChange={setKind}>
                            <TabsList>
                                <TabsTrigger value="all">All ({items.length})</TabsTrigger>
                                <TabsTrigger value="feedback">Feedback</TabsTrigger>
                                <TabsTrigger value="crash">Crashes</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>

                    <div className="flex min-h-0 flex-1 gap-4">
                        <div className={cn("w-full shrink-0 overflow-y-auto lg:w-88", showsDetail && "max-lg:hidden")}>
                            {shown.length === 0 ? (
                                <EmptyState icon={MessageSquare} title="No matches" description={`Nothing matches “${query}”.`} />
                            ) : (
                                <Card size="none">
                                    {shown.map(item => (
                                        <Item
                                            key={item.id}
                                            variant="row"
                                            size="none"
                                            className={cn(item.id === selected?.id && "bg-selected")}
                                            render={<button type="button" onClick={() => { setSelectedId(item.id); setShowsDetail(true); }} />}
                                        >
                                            <ItemMedia variant="rowIcon"><TypeIcon type={item.type} /></ItemMedia>
                                            <ItemContent className="min-w-0 gap-0.5">
                                                <ItemTitle className="w-full type-row text-foreground"><span className="line-clamp-2">{item.message}</span></ItemTitle>
                                                <ItemDescription className="truncate type-note">
                                                    {[typeLabel(item.type), formatTimeAgo(item.timestamp, now, 'en'), item.email].filter(Boolean).join(' · ')}
                                                </ItemDescription>
                                            </ItemContent>
                                        </Item>
                                    ))}
                                </Card>
                            )}
                        </div>

                        <div className={cn("min-w-0 flex-1 overflow-y-auto", !showsDetail && "max-lg:hidden")}>
                            {selected && <FeedbackDetail item={selected} now={now} onBack={() => setShowsDetail(false)} />}
                        </div>
                    </div>
                </>
            )}
        </AdminLayout>
    );
};
