import React from 'react';
import { cn } from '@/lib/cn';
import { FALLBACK_ROUTE_COLOR, STOP_SEARCH } from '@/config/constants';
import { LineBadge } from '@/components/LineBadge';
import { Autocomplete } from '@base-ui/react/autocomplete';
import type { LineBadgeData } from '@/domain/routes';

interface SearchItemProps {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    lines?: LineBadgeData[];
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
export const LineBadges = ({ lines }: { lines: SearchItemProps['lines'] }) => {
    if (!lines || lines.length === 0) return null;

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
            {uniqueLines.slice(0, STOP_SEARCH.LINE_BADGE_LIMIT).map((line, idx) => {
                const name = String(line.name || '');
                if (!name) return null;

                return (
                    <div key={`${name}-${idx}`} className="mr-1.5 flex shrink-0">
                        <LineBadge name={name} routeColor={line.route_color || FALLBACK_ROUTE_COLOR} />
                    </div>
                );
            })}
            
            {uniqueLines.length > 5 && (
                <span className="inline-flex items-center justify-center h-4.25 px-1 min-w-4.25 rounded-badge bg-fill-2 text-muted-foreground text-caption font-bold mr-1.5">
                    +{uniqueLines.length - 5}
                </span>
            )}
        </>
    );
};

/**
 * SearchItem
 *
 * A single row in the search dropdown; Enter on the keyboard-highlighted row triggers onClick.
 * Supports default, primary (line filter), and highlighted (favorite) visual variants.
 */
export const SearchItem = ({ icon, title, subtitle, lines, onClick, variant = 'default', highlight = false, testId }: SearchItemProps) => {

    return (
        <Autocomplete.Item
            value={testId || title}
            onClick={onClick}
            data-testid={testId}
            className={cn(
                'relative w-full px-3.5 py-3 min-h-13 flex items-center gap-3 rounded-2xl cursor-pointer select-none outline-hidden text-sm transition-colors [&_svg]:pointer-events-none [&_svg]:shrink-0',
                variant === 'primary'
                    ? 'data-highlighted:bg-primary/15 hover:bg-primary/15 text-primary'
                    : 'data-highlighted:bg-fill hover:bg-fill active:bg-fill-2'
            )}
        >
            <div className={cn(
                'shrink-0 flex items-center justify-center',
                variant === 'primary' ? 'text-primary' : highlight ? 'text-favorite' : 'text-muted-foreground'
            )}>
                {icon}
            </div>
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="text-foreground font-medium leading-tight text-base truncate">
                    {title}
                </span>
                
                <div className="flex flex-wrap items-center gap-y-1">
                    <LineBadges lines={lines} />

                    {subtitle && (
                        <span className="text-muted-foreground text-body-sm truncate">
                            {subtitle}
                        </span>
                    )}
                </div>
            </div>
        </Autocomplete.Item>
    );
};
