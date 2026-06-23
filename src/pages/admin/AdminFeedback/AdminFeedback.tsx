import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { JsonView, allExpanded, darkStyles, defaultStyles } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';

import type { StoredFeedback } from '../../../types/feedback';

import { Badge } from '@/components/ui/badge';
import { Bug, Lightbulb, MessageSquare, Loader2, RefreshCw, Search, ChevronDown, AlertOctagon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AdminLayout } from '../AdminLayout';

export const AdminFeedback: React.FC = () => {
    const [filterText, setFilterText] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'feedback' | 'crash'>('all');
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{ items: StoredFeedback[] }>({
        queryKey: ['adminFeedback'],
        queryFn: async () => {
            const res = await fetch('/api/admin/feedback');
            if (!res.ok) throw new Error('Failed to fetch feedback');
            return res.json();
        }
    });

    const filteredItems = data?.items?.filter(item => {
        // Type filter
        if (filterType === 'crash' && item.type !== 'crash') return false;
        if (filterType === 'feedback' && item.type === 'crash') return false; // Anything that isn't a crash is considered standard feedback

        // Text filter
        if (!filterText) return true;
        const search = filterText.toLowerCase();
        
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

    const isValidSelection = selectedItemId && filteredItems?.find(i => i.id === selectedItemId);
    const activeItemId = isValidSelection ? selectedItemId : (filteredItems?.[0]?.id || null);
    const selectedItem = filteredItems?.find(item => item.id === activeItemId) || null;

    const isDark = document.documentElement.classList.contains('dark');

    const getIcon = (type: string) => {
        switch (type) {
            case 'crash': return <AlertOctagon className="w-4 h-4 text-red-600" />;
            case 'bug': return <Bug className="w-4 h-4 text-red-500" />;
            case 'feature_request': return <Lightbulb className="w-4 h-4 text-yellow-500" />;
            default: return <MessageSquare className="w-4 h-4 text-blue-500" />;
        }
    };

    const getBadgeVariant = (type: string): 'destructive' | 'default' | 'secondary' => {
        switch (type) {
            case 'crash': return 'destructive';
            case 'bug': return 'destructive';
            case 'feature_request': return 'default';
            default: return 'secondary';
        }
    };

    const headerActions = (
        <Button onClick={() => refetch()} disabled={isFetching} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
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
                <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-border border-dashed shrink-0">
                    No feedback yet.
                </div>
            )}

            {!isLoading && !isError && (data?.items?.length || 0) > 0 && (
                <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Filter by text, email, ID or IP address..." 
                            className="pl-10"
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                        />
                    </div>
                    <div className="flex bg-muted/50 p-1 rounded-md border border-border shrink-0">
                        <Button 
                            variant={filterType === 'all' ? 'default' : 'ghost'} 
                            size="sm" 
                            onClick={() => setFilterType('all')}
                            className="flex-1 sm:flex-none h-8"
                        >
                            All
                        </Button>
                        <Button 
                            variant={filterType === 'feedback' ? 'default' : 'ghost'} 
                            size="sm" 
                            onClick={() => setFilterType('feedback')}
                            className="flex-1 sm:flex-none h-8"
                        >
                            <MessageSquare className="w-3.5 h-3.5 mr-1.5 opacity-70" />
                            Feedback
                        </Button>
                        <Button 
                            variant={filterType === 'crash' ? 'destructive' : 'ghost'} 
                            size="sm" 
                            onClick={() => setFilterType('crash')}
                            className={`flex-1 sm:flex-none h-8 ${filterType === 'crash' ? '' : 'text-red-500 hover:text-red-600 hover:bg-red-500/10'}`}
                        >
                            <AlertOctagon className="w-3.5 h-3.5 mr-1.5" />
                            Crashes
                        </Button>
                    </div>
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
                {/* Left Column: List */}
                <div className="w-full lg:w-[350px] shrink-0 flex flex-col gap-2 overflow-y-auto pr-1 pb-4">
                    {filteredItems?.length === 0 && data?.items?.length !== 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                            No results found for filter "{filterText}".
                        </div>
                    )}
                    {filteredItems?.map((item) => (
                        <div 
                            key={item.id} 
                            onClick={() => setSelectedItemId(item.id)}
                            className={`cursor-pointer rounded-lg p-3.5 transition-colors border text-left flex flex-col gap-2 ${activeItemId === item.id ? 'bg-muted/60 border-primary/30 shadow-sm' : 'bg-card hover:bg-muted/30 border-border'} ${item.type === 'crash' ? (activeItemId === item.id ? 'bg-red-500/10 border-red-500/40' : 'bg-red-500/5 hover:bg-red-500/10 border-red-500/20') : ''}`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    {getIcon(item.type)}
                                    <span className="text-xs font-semibold uppercase tracking-wider">{item.type.replace('_', ' ')}</span>
                                </div>
                                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                    {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                                </span>
                            </div>
                            <p className="text-sm line-clamp-2 text-foreground/90 font-medium">
                                {item.message}
                            </p>
                            {item.email && (
                                <div className="text-[10px] text-primary mt-1 truncate">
                                    {item.email}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Right Column: Detail */}
                <div className="flex-1 min-w-0 bg-card rounded-xl border border-border overflow-hidden flex flex-col shadow-sm">
                    {selectedItem ? (
                        <ScrollArea className={`h-full w-full ${selectedItem.type === 'crash' ? 'bg-red-500/5' : ''}`}>
                            <div className="p-6 flex flex-col gap-6">
                                {/* Header */}
                                <div className="flex justify-between items-start sm:items-center gap-4 flex-col sm:flex-row">
                                    <div className="flex items-center gap-3">
                                        {getIcon(selectedItem.type)}
                                        <Badge variant={getBadgeVariant(selectedItem.type)} className="capitalize px-3 py-1 text-sm">
                                            {selectedItem.type.replace('_', ' ')}
                                        </Badge>
                                        <span className="text-sm text-muted-foreground">
                                            {formatDistanceToNow(new Date(selectedItem.timestamp), { addSuffix: true })}
                                        </span>
                                    </div>
                                    {selectedItem.email && (
                                        <div className="text-sm font-medium px-3 py-1.5 bg-primary/10 text-primary rounded-full truncate max-w-[250px] sm:max-w-none">
                                            {selectedItem.email}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Message */}
                                <div className="bg-background rounded-lg p-5 border border-border shadow-sm">
                                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground font-semibold">{selectedItem.message}</p>
                                </div>

                                {/* Crash Stack Traces */}
                                {selectedItem.type === 'crash' && selectedItem.diagnostics?.crashInfo && (
                                    <div className="flex flex-col gap-4">
                                        {selectedItem.diagnostics.crashInfo.errorStack && (
                                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 shadow-sm">
                                                <p className="text-sm font-bold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-2">
                                                    <AlertOctagon className="w-4 h-4" />
                                                    Error Stack
                                                </p>
                                                <pre className="text-xs text-red-700/90 whitespace-pre-wrap font-mono overflow-x-auto bg-red-500/5 p-3 rounded-md border border-red-500/10">
                                                    {selectedItem.diagnostics.crashInfo.errorStack}
                                                </pre>
                                            </div>
                                        )}
                                        {selectedItem.diagnostics.crashInfo.componentStack && (
                                            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 shadow-sm">
                                                <p className="text-sm font-bold text-orange-600 uppercase tracking-wide mb-2 flex items-center gap-2">
                                                    <AlertOctagon className="w-4 h-4" />
                                                    Component Stack
                                                </p>
                                                <pre className="text-xs text-orange-700/90 whitespace-pre-wrap font-mono overflow-x-auto bg-orange-500/5 p-3 rounded-md border border-orange-500/10">
                                                    {selectedItem.diagnostics.crashInfo.componentStack}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                {/* Meta Information */}
                                <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs text-muted-foreground/80 bg-muted/30 p-4 rounded-lg border border-border/50">
                                    <p className="flex flex-col gap-1"><span className="uppercase text-[10px] font-bold tracking-wider">Feedback ID</span><span className="font-mono">{selectedItem.id}</span></p>
                                    <p className="flex flex-col gap-1"><span className="uppercase text-[10px] font-bold tracking-wider">Client IP</span><span className="font-mono">{selectedItem.ipAddress}</span></p>
                                    <p className="flex flex-col gap-1"><span className="uppercase text-[10px] font-bold tracking-wider">Exact Time</span><span>{new Date(selectedItem.timestamp).toLocaleString()}</span></p>
                                </div>
                                
                                {/* Diagnostics Collapsible */}
                                {selectedItem.diagnostics && (
                                    <Collapsible className="bg-muted/30 rounded-lg border border-border">
                                        <CollapsibleTrigger className="w-full flex justify-between items-center p-4 h-auto hover:bg-muted/50 transition-colors rounded-lg [&[data-state=open]>svg]:rotate-180">
                                            <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                                <Bug className="w-4 h-4" />
                                                Full Diagnostic Data
                                            </span>
                                            <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200" />
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="px-4 pb-4">
                                            <div className="w-full rounded-md mt-2 bg-background p-4 border border-border shadow-inner">
                                                <div className="text-sm [&>div]:bg-transparent! font-mono">
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
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-12 text-center gap-4">
                            <MessageSquare className="w-12 h-12 opacity-20" />
                            <p className="text-lg font-medium">Select an item from the list</p>
                            <p className="text-sm opacity-70">Click on a feedback or crash report on the left to view its detailed payload here.</p>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
};
