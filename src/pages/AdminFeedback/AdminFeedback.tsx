import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { JsonView, allExpanded, darkStyles, defaultStyles } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';

import type { StoredFeedback } from '../../types/feedback';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bug, Lightbulb, MessageSquare, Loader2, RefreshCw, Search, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export const AdminFeedback: React.FC = () => {
    const [filterText, setFilterText] = useState('');
    const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{ items: StoredFeedback[] }>({
        queryKey: ['adminFeedback'],
        queryFn: async () => {
            const res = await fetch('/api/admin/feedback');
            if (!res.ok) throw new Error('Failed to fetch feedback');
            return res.json();
        }
    });

    const filteredItems = data?.items?.filter(item => {
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

    const isDark = document.documentElement.classList.contains('dark');

    const getIcon = (type: string) => {
        switch (type) {
            case 'bug': return <Bug className="w-4 h-4 text-red-500" />;
            case 'feature_request': return <Lightbulb className="w-4 h-4 text-yellow-500" />;
            default: return <MessageSquare className="w-4 h-4 text-blue-500" />;
        }
    };

    const getBadgeVariant = (type: string): 'destructive' | 'default' | 'secondary' => {
        switch (type) {
            case 'bug': return 'destructive';
            case 'feature_request': return 'default';
            default: return 'secondary';
        }
    };

    return (
        <div className="h-[100dvh] w-full overflow-y-auto bg-background text-foreground">
            <div className="p-6 max-w-5xl mx-auto flex flex-col gap-6 min-h-full">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Feedback Hub</h1>
                    <p className="text-muted-foreground">Overview of user feedback.</p>
                </div>
                <Button onClick={() => refetch()} disabled={isFetching} variant="outline" size="sm">
                    <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {isLoading && (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            )}

            {isError && (
                <div className="bg-destructive/10 text-destructive p-4 rounded-lg border border-destructive/20">
                    <h3 className="font-bold">Error loading feedback</h3>
                    <p>{(error as Error).message}</p>
                </div>
            )}

            {!isLoading && !isError && data?.items?.length === 0 && (
                <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-border border-dashed">
                    No feedback yet.
                </div>
            )}

            {!isLoading && !isError && (data?.items?.length || 0) > 0 && (
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Filter by text, type, email, ID or IP address..." 
                        className="pl-10"
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                    />
                </div>
            )}

            <div className="grid gap-4">
                {filteredItems?.length === 0 && data?.items?.length !== 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                        No results found for filter "{filterText}".
                    </div>
                )}
                {filteredItems?.map((item) => (
                    <Card key={item.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="flex flex-col gap-2.5">
                            {/* Header row: Icon, Type, Time, Email */}
                            <div className="flex justify-between items-start sm:items-center gap-4 flex-col sm:flex-row">
                                <div className="flex items-center gap-3">
                                    {getIcon(item.type)}
                                    <Badge variant={getBadgeVariant(item.type)} className="capitalize">
                                        {item.type.replace('_', ' ')}
                                    </Badge>
                                    <span className="text-sm text-muted-foreground">
                                        {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                                    </span>
                                </div>
                                {item.email && (
                                    <div className="text-xs font-medium px-2.5 py-1 bg-primary/10 text-primary rounded-full truncate max-w-[200px] sm:max-w-none">
                                        {item.email}
                                    </div>
                                )}
                            </div>
                            
                            {/* Message */}
                            <div>
                                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{item.message}</p>
                            </div>
                            
                            {/* Meta Information */}
                            <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-muted-foreground/60 border-t border-border/40 pt-2.5">
                                <p>ID: <span className="font-mono">{item.id}</span></p>
                                <p>IP: <span className="font-mono">{item.ipAddress}</span></p>
                                <p>{new Date(item.timestamp).toLocaleString()}</p>
                            </div>
                            
                            {/* Diagnostics Collapsible */}
                            {item.diagnostics && (
                                <Collapsible className="bg-muted/30 rounded-lg border border-border mt-1">
                                    <CollapsibleTrigger asChild>
                                        <Button variant="ghost" className="w-full flex justify-between items-center p-3 h-auto hover:bg-muted/30 rounded-lg [&[data-state=open]>svg]:rotate-180">
                                            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                                Diagnostic data
                                            </span>
                                            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200" />
                                        </Button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="px-3 pb-3">
                                        <ScrollArea className="h-[400px] w-full rounded-md mt-2 bg-muted/20 p-3 border border-border">
                                            <div className="text-sm [&>div]:!bg-transparent">
                                                <JsonView 
                                                    data={item.diagnostics} 
                                                    shouldExpandNode={allExpanded} 
                                                    style={isDark ? darkStyles : defaultStyles} 
                                                />
                                            </div>
                                        </ScrollArea>
                                    </CollapsibleContent>
                                </Collapsible>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>
            </div>
        </div>
    );
};
