import React from 'react';
import { cn } from '@/lib/utils';
import { FALLBACK_ROUTE_COLOR } from '@/config/constants';
import { LineBadge } from '../../LineBadge';
import { CommandItem } from '@/components/ui/command';

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
                <span className="inline-flex items-center justify-center h-4.25 px-1 min-w-4.25 rounded-xs bg-muted text-muted-foreground text-[9px] font-bold mr-1.5 border border-border/50">
                    +{uniqueLines.length - 5}
                </span>
            )}
        </>
    );
};

/**
 * SearchItem
 *
 * A single row in the search dropdown using Shadcn CommandItem.
 * Supports default, primary (line filter), and highlighted (favorite) visual variants.
 */
export const SearchItem = ({ icon, title, subtitle, metroLines, lines, onClick, variant = 'default', highlight = false, testId }: SearchItemProps) => {
    // If we have explicit lines (enriched), use them. Fallback to legacy metroLines.
    const displayLines = lines || metroLines?.map(m => ({ name: m.name, type: 'metro', route_color: m.route_color }));

    return (
        <CommandItem
            value={testId || title}
            onSelect={onClick}
            data-testid={testId}
            className={cn(
                'w-full px-3 py-2 flex items-center gap-3 rounded-xl cursor-pointer transition-colors my-0.5',
                '[&_svg.lucide-check]:hidden', // hide the default checkmark
                variant === 'primary'
                    ? 'data-[selected=true]:bg-primary/15! hover:bg-primary/15! text-primary'
                    : 'data-[selected=true]:bg-accent! hover:bg-accent! active:bg-accent/80!'
            )}
        >
            <div className={cn(
                'rounded-lg shrink-0 w-7 h-7 flex items-center justify-center transition-colors',
                variant === 'primary' ? 'bg-primary/15 text-primary' :
                highlight ? 'bg-amber-500/15 text-amber-500' : 'bg-foreground/5 text-muted-foreground/80 group-data-[selected=true]/command-item:text-foreground'
            )}>
                {icon}
            </div>
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="text-foreground font-semibold leading-tight text-[13px] truncate">
                    {title}
                </span>
                
                <div className="flex flex-wrap items-center gap-y-1">
                    <LineBadges lines={displayLines} />

                    {subtitle && (
                        <span className="text-muted-foreground/70 text-[10.5px] font-medium truncate">
                            {subtitle}
                        </span>
                    )}
                </div>
            </div>
        </CommandItem>
    );
};

SearchItem.displayName = 'SearchItem';
