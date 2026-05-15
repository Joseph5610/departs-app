import React from 'react';
import { cn } from '@/lib/utils';
import { FALLBACK_ROUTE_COLOR } from '@/config/constants';
import { Box, Stack, Surface } from '@/components/ui/layout';
import { LineBadge } from '../../LineBadge';

interface SearchItemProps {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    metroLines?: Array<{ name: string, route_color: string }>;
    lines?: Array<{ name: string, type: string, route_color?: string }>;
    onClick: () => void;
    variant?: 'default' | 'primary';
    highlight?: boolean;
    testId?: string;
}

/**
 * LineBadges
 *
 * Renders a list of color-coded transit line badges.
 * Extracted from SearchItem to avoid IIFE in JSX.
 */
const LineBadges = ({ lines }: { lines: SearchItemProps['lines'] }) => {
    if (!lines || lines.length === 0) return null;

    // Deduplicate lines by name
    const uniqueLines: NonNullable<SearchItemProps['lines']> = [];
    const seen = new Set();
    for (const line of lines) {
        if (!seen.has(line.name)) {
            seen.add(line.name);
            uniqueLines.push(line);
        }
    }

    return (
        <>
            {uniqueLines.slice(0, 5).map((line, idx) => {
                const name = String(line.name || '');
                if (!name) return null;

                return (
                    <div key={`${name}-${idx}`} className="mr-1.5 flex shrink-0">
                        <LineBadge name={name} routeColor={line.route_color || FALLBACK_ROUTE_COLOR} />
                    </div>
                );
            })}
            
            {uniqueLines.length > 5 && (
                <span className="inline-flex items-center justify-center h-[17px] px-1 min-w-[17px] rounded-[3px] bg-white/10 text-white/60 text-[9px] font-bold mr-1.5 border border-white/5">
                    +{uniqueLines.length - 5}
                </span>
            )}
        </>
    );
};

/**
 * SearchItem
 *
 * A single row in the search dropdown. Supports default, primary (line filter),
 * and highlighted (favorite) visual variants.
 */
export const SearchItem = ({ icon, title, subtitle, metroLines, lines, onClick, variant = 'default', highlight = false, testId }: SearchItemProps) => {
    // If we have explicit lines (enriched), use them. Fallback to legacy metroLines.
    const displayLines = lines || metroLines?.map(m => ({ name: m.name, type: 'metro', route_color: m.route_color }));

    return (
        <Surface
            asChild
            variant="ghost"
            className={cn(
                "w-full px-4 py-3 flex flex-row items-center gap-3 transition-colors text-left outline-none focus-visible:bg-white/10 rounded-none",
                variant === 'primary' ? "hover:bg-primary/10 active:bg-primary/20" : "hover:bg-white/10 active:bg-white/15"
            )}
        >
            <button 
                onClick={onClick}
                data-testid={testId}
            >
                <Box center padding="sm" className={cn(
                    "rounded-lg shrink-0",
                    variant === 'primary' ? "bg-primary/10 text-primary" :
                    highlight ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground"
                )}>
                    {icon}
                </Box>
                <Stack gap={1} className="min-w-0 flex-1">
                    <span className="text-foreground font-medium line-clamp-2 leading-tight">
                        {title}
                    </span>
                    
                    <div className="flex flex-wrap items-center gap-y-1 mt-0.5">
                        <LineBadges lines={displayLines} />

                        {subtitle && (
                            <span className="text-muted-foreground/60 text-[10.5px] font-medium line-clamp-1">
                                {subtitle}
                            </span>
                        )}
                    </div>
                </Stack>
            </button>
        </Surface>
    );
};

SearchItem.displayName = 'SearchItem';
