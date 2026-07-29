import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { JsonView, allExpanded, darkStyles, defaultStyles } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';

import type { StoredFeedback } from '../../../types/feedback';

import { Badge } from '@/components/ui/badge';
import { Bug, Lightbulb, MessageSquare, Loader2, RefreshCw, Search, ChevronDown, AlertOctagon, Copy, Terminal, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AdminLayout } from '../AdminLayout';
import { toast } from 'sonner';

export const AdminFeedback: React.FC = () => {
    const [filterText, setFilterText] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'feedback' | 'crash'>('all');
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [showMobileDetail, setShowMobileDetail] = useState(false);

    const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{ items: StoredFeedback[] }>({
        queryKey: ['adminFeedback'],
        queryFn: async () => {
            const res = await fetch('/api/admin/feedback');
            if (!res.ok) throw new Error('Failed to fetch feedback');
            return res.json();
        }
    });

    const filteredItems = useMemo(() => {
        if (!data?.items) return [];
        const search = filterText.trim().toLowerCase();
        
        return data.items.filter(item => {
            if (filterType === 'crash' && item.type !== 'crash') return false;
            if (filterType === 'feedback' && item.type === 'crash') return false;
            if (!search) return true;

            const matchBasic = (
                item.message.toLowerCase().includes(search) ||
                item.type.toLowerCase().includes(search) ||
                item.id.toLowerCase().includes(search) ||
                (item.email && item.email.toLowerCase().includes(search)) ||
                (item.ipAddress && item.ipAddress.toLowerCase().includes(search))
            );

            if (matchBasic) return true;
            if (item.diagnostics) {
                return JSON.stringify(item.diagnostics).toLowerCase().includes(search);
            }
            return false;
        });
    }, [data, filterType, filterText]);

    const selectedItem = useMemo(() => {
        if (!filteredItems.length) return null;
        return filteredItems.find(item => item.id === selectedItemId) || filteredItems[0];
    }, [filteredItems, selectedItemId]);

    const activeItemId = selectedItem?.id || null;

    const isDark = document.documentElement.classList.contains('dark');

    const getIcon = (type: string) => {
        switch (type) {
            case 'crash': return <AlertOctagon className="w-4 h-4 text-red-500" />;
            case 'bug': return <Bug className="w-4 h-4 text-red-400" />;
            case 'feature_request': return <Lightbulb className="w-4 h-4 text-amber-400" />;
            default: return <MessageSquare className="w-4 h-4 text-sky-400" />;
        }
    };

    const handleCopyRawJson = () => {
        if (!selectedItem) return;
        navigator.clipboard.writeText(JSON.stringify(selectedItem, null, 2))
            .then(() => toast.success('Raw JSON copied to clipboard'))
            .catch(() => toast.error('Failed to copy to clipboard'));
    };

    const handleCopyAgentPrompt = () => {
        if (!selectedItem) return;
        
        let crashBlock = '';
        if (selectedItem.type === 'crash' && selectedItem.diagnostics?.crashInfo) {
            crashBlock = `
## Crash Trace & Diagnostics
**Error Message:** \`${selectedItem.diagnostics.crashInfo.errorMessage || selectedItem.message}\`
**Error Name:** \`${selectedItem.diagnostics.crashInfo.errorName || 'Error'}\`

### Error Stack
\`\`\`
${selectedItem.diagnostics.crashInfo.errorStack || 'N/A'}
\`\`\`

### Component Stack
\`\`\`
${selectedItem.diagnostics.crashInfo.componentStack || 'N/A'}
\`\`\`
`;
        }

        const promptText = `I encountered a bug/crash in the application. Please investigate and fix this issue:

### Description / Feedback Message
> ${selectedItem.message}

${crashBlock}
### App Context
- **URL / Path:** \`${selectedItem.diagnostics?.url || 'N/A'}\`
- **Selected City:** \`${selectedItem.diagnostics?.selectedCity || 'N/A'}\`
- **Locale:** \`${selectedItem.diagnostics?.locale || 'N/A'}\`
- **PWA Mode:** \`${selectedItem.diagnostics?.isPwa ? 'Yes' : 'No'}\`
- **User Agent:** \`${selectedItem.diagnostics?.userAgent || 'N/A'}\`
- **Feedback ID:** \`${selectedItem.id}\`
- **Time of Occurrence:** ${new Date(selectedItem.timestamp).toLocaleString()}

### Full Diagnostic Payload
\`\`\`json
${JSON.stringify(selectedItem.diagnostics || {}, null, 2)}
\`\`\`

Please locate the source code files mentioned in the stack traces above, diagnose the root cause (e.g. unexpected null/undefined values or unhandled exceptions), and implement a robust fix.`;

        navigator.clipboard.writeText(promptText)
            .then(() => toast.success('Agent prompt template copied to clipboard!'))
            .catch(() => toast.error('Failed to copy prompt'));
    };

    const headerActions = (
        <Button 
            onClick={() => refetch()} 
            disabled={isFetching} 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/10 shrink-0 cursor-pointer"
            title="Refresh Feedback"
        >
            <RefreshCw size={16} className={isFetching ? 'animate-spin text-primary' : ''} />
        </Button>
    );

    return (
        <AdminLayout 
            title="Feedback Hub" 
            headerActions={headerActions} 
            contentClassName="p-4 sm:p-6 flex flex-col gap-4 max-w-7xl mx-auto w-full min-h-0"
        >
            {isLoading && (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            )}

            {isError && (
                <div className="bg-destructive/10 text-destructive p-4 rounded-lg border border-destructive/20 shrink-0">
                    <h3 className="font-bold">Error loading feedback</h3>
                    <p>{(error as Error).message}</p>
                </div>
            )}

            {!isLoading && !isError && data?.items?.length === 0 && (
                <div className="text-center py-12 text-muted-foreground bg-card/50 rounded-2xl border border-border/40 border-dashed shrink-0 flex flex-col items-center justify-center gap-3">
                    <MessageSquare size={32} className="opacity-30 text-muted-foreground" />
                    <p className="font-mono text-xs">No feedback or bug reports collected yet.</p>
                </div>
            )}

            {!isLoading && !isError && (data?.items?.length || 0) > 0 && (
                <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70" />
                        <Input 
                            placeholder="Filter by message, email, ID or IP..." 
                            className="h-9 pl-9 text-xs rounded-xl bg-foreground/5 border-border/40 text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/50"
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                        />
                    </div>
                    <Tabs value={filterType} onValueChange={(v) => setFilterType(v as 'all' | 'feedback' | 'crash')}>
                        <TabsList variant="default" className="h-9 p-1 rounded-xl bg-foreground/5 border border-border/40 shrink-0">
                            <TabsTrigger value="all" className="h-7 text-xs font-semibold rounded-lg px-3">
                                All ({data?.items?.length || 0})
                            </TabsTrigger>
                            <TabsTrigger value="feedback" className="h-7 text-xs font-semibold rounded-lg px-3 gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5 opacity-70" />
                                Feedback
                            </TabsTrigger>
                            <TabsTrigger value="crash" className="h-7 text-xs font-semibold rounded-lg px-3 gap-1.5 data-active:text-red-400">
                                <AlertOctagon className="w-3.5 h-3.5 text-red-500" />
                                Crashes
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            )}

            <div className="flex gap-4 flex-1 min-h-0 relative">
                {/* Left Column: List */}
                <div className={`w-full lg:w-87.5 shrink-0 flex flex-col gap-2.5 overflow-y-auto pr-1 pb-4 ${showMobileDetail ? 'hidden lg:flex' : 'flex'}`}>
                    {filteredItems?.length === 0 && data?.items?.length !== 0 && (
                        <div className="text-center py-8 text-muted-foreground/70 font-mono text-xs">
                            No results found for "{filterText}".
                        </div>
                    )}
                    {filteredItems?.map((item) => {
                        const isSelected = activeItemId === item.id;
                        const isCrash = item.type === 'crash';
                        return (
                            <div 
                                key={item.id} 
                                onClick={() => {
                                    setSelectedItemId(item.id);
                                    setShowMobileDetail(true);
                                }}
                                className={`cursor-pointer rounded-xl p-3.5 transition-all border text-left flex flex-col gap-2 ${
                                    isSelected 
                                        ? (isCrash ? 'bg-red-500/10 border-red-500/40 ring-1 ring-red-500/20 shadow-xs' : 'bg-card border-primary/50 ring-1 ring-primary/20 shadow-xs') 
                                        : (isCrash ? 'bg-red-500/3 hover:bg-red-500/8 border-red-500/20' : 'bg-card/60 hover:bg-card border-border/40 hover:border-border/70')
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                        {getIcon(item.type)}
                                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-foreground/5 border-border/40 text-muted-foreground">
                                            {item.type.replace('_', ' ')}
                                        </Badge>
                                    </div>
                                    <span className="text-[11px] font-mono text-muted-foreground/70 whitespace-nowrap">
                                        {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                                    </span>
                                </div>
                                <p className="text-xs line-clamp-2 text-foreground/90 font-medium leading-relaxed">
                                    {item.message}
                                </p>
                                {item.email && (
                                    <div className="text-[11px] font-mono text-primary/90 truncate flex items-center gap-1 mt-0.5">
                                        <span className="opacity-60">@</span> {item.email}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Right Column: Detail */}
                <div className={`flex-1 min-w-0 bg-card/80 backdrop-blur-md rounded-2xl border border-border/40 overflow-hidden flex flex-col shadow-xs ${!showMobileDetail ? 'hidden lg:flex' : 'flex'}`}>
                    {selectedItem ? (
                        <ScrollArea className={`h-full w-full ${selectedItem.type === 'crash' ? 'bg-red-500/2' : ''}`}>
                            <div className="p-4 sm:p-6 flex flex-col gap-5">
                                {/* Mobile back button */}
                                <div className="lg:hidden flex items-center mb-1">
                                    <Button variant="ghost" size="sm" onClick={() => setShowMobileDetail(false)} className="-ml-2 h-8 text-xs font-semibold gap-1 rounded-lg">
                                        <ArrowLeft className="w-4 h-4" />
                                        Back to list
                                    </Button>
                                </div>

                                {/* Header Bar */}
                                <div className="flex justify-between items-start gap-4 flex-col sm:flex-row sm:items-center border-b border-border/40 pb-4">
                                    <div className="flex flex-wrap items-center gap-2.5">
                                        {getIcon(selectedItem.type)}
                                        <Badge variant="outline" className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 bg-foreground/5 border-border/40 text-foreground">
                                            {selectedItem.type.replace('_', ' ')}
                                        </Badge>
                                        <span className="text-xs font-mono text-muted-foreground/70">
                                            {formatDistanceToNow(new Date(selectedItem.timestamp), { addSuffix: true })}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={handleCopyRawJson} 
                                            className="h-8 px-3 rounded-lg text-xs font-semibold gap-1.5 bg-foreground/5 hover:bg-foreground/10 border-border/40 text-foreground transition-all cursor-pointer flex-1 sm:flex-none"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                            Copy Raw JSON
                                        </Button>
                                        <Button 
                                            variant="default" 
                                            size="sm" 
                                            onClick={handleCopyAgentPrompt} 
                                            className="h-8 px-3 rounded-lg text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs transition-all cursor-pointer flex-1 sm:flex-none"
                                        >
                                            <Terminal className="w-3.5 h-3.5" />
                                            Copy Agent Prompt
                                        </Button>
                                    </div>
                                </div>

                                {selectedItem.email && (
                                    <div className="text-xs font-mono font-semibold px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg truncate max-w-xs self-start">
                                        {selectedItem.email}
                                    </div>
                                )}
                                
                                {/* Message */}
                                <div className="bg-foreground/3 rounded-xl p-4.5 border border-border/40 shadow-2xs">
                                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground font-medium">{selectedItem.message}</p>
                                </div>

                                {/* Crash Stack Traces */}
                                {selectedItem.type === 'crash' && selectedItem.diagnostics?.crashInfo && (
                                    <div className="flex flex-col gap-3">
                                        {selectedItem.diagnostics.crashInfo.errorStack && (
                                            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 shadow-2xs">
                                                <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                    <AlertOctagon className="w-3.5 h-3.5" />
                                                    Error Stack
                                                </p>
                                                <pre className="text-[11px] text-red-400 whitespace-pre-wrap font-mono overflow-x-auto bg-black/40 p-3 rounded-lg border border-red-500/20">
                                                    {selectedItem.diagnostics.crashInfo.errorStack}
                                                </pre>
                                            </div>
                                        )}
                                        {selectedItem.diagnostics.crashInfo.componentStack && (
                                            <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 shadow-2xs">
                                                <p className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                    <AlertOctagon className="w-3.5 h-3.5" />
                                                    Component Stack
                                                </p>
                                                <pre className="text-[11px] text-orange-300 whitespace-pre-wrap font-mono overflow-x-auto bg-black/40 p-3 rounded-lg border border-orange-500/20">
                                                    {selectedItem.diagnostics.crashInfo.componentStack}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                {/* Meta Information */}
                                <div className="flex flex-col gap-2 text-xs font-mono text-muted-foreground/80 bg-foreground/2 p-4 rounded-xl border border-border/40">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
                                        <span className="uppercase text-[10px] font-extrabold tracking-widest text-muted-foreground/60 sm:w-28 shrink-0">Feedback ID:</span>
                                        <span className="text-foreground/90 font-mono break-all">{selectedItem.id}</span>
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
                                        <span className="uppercase text-[10px] font-extrabold tracking-widest text-muted-foreground/60 sm:w-28 shrink-0">Client IP:</span>
                                        <span className="text-foreground/90 font-mono">{selectedItem.ipAddress}</span>
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
                                        <span className="uppercase text-[10px] font-extrabold tracking-widest text-muted-foreground/60 sm:w-28 shrink-0">Exact Time:</span>
                                        <span className="text-foreground/90 font-mono">{new Date(selectedItem.timestamp).toLocaleString()}</span>
                                    </div>
                                </div>
                                
                                {/* Diagnostics Collapsible */}
                                {selectedItem.diagnostics && (
                                    <Collapsible className="bg-foreground/2 rounded-xl border border-border/40 overflow-hidden">
                                        <CollapsibleTrigger className="w-full flex justify-between items-center p-3.5 hover:bg-foreground/5 transition-colors cursor-pointer data-[state=open]:[&>svg]:rotate-180">
                                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                                <Bug className="w-3.5 h-3.5 text-primary" />
                                                Full Diagnostic Payload
                                            </span>
                                            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200" />
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="px-3.5 pb-3.5">
                                            <div className="w-full rounded-xl bg-black/40 p-3.5 border border-border/40 shadow-inner overflow-hidden">
                                                <div className="text-xs [&>div]:bg-transparent! font-mono overflow-x-auto">
                                                    <JsonView 
                                                        data={selectedItem.diagnostics} 
                                                        shouldExpandNode={allExpanded} 
                                                        style={isDark ? darkStyles : defaultStyles} 
                                                    />
                                                </div>
                                            </div>
                                        </CollapsibleContent>
                                    </Collapsible>
                                )}
                            </div>
                        </ScrollArea>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-12 text-center gap-3">
                            <MessageSquare className="w-10 h-10 opacity-20" />
                            <p className="text-sm font-semibold text-foreground/80">Select an item from the list</p>
                            <p className="text-xs opacity-70 max-w-xs font-mono">Click on a feedback or crash report on the left to view its detailed diagnostics.</p>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
};
