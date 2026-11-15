import React from 'react';
import { cn } from '@/lib/cn';
import { FALLBACK_ROUTE_COLOR, STOP_SEARCH } from '@/config/constants';
import { LineBadge } from '@/components/LineBadge';
import { Autocomplete } from '@base-ui/react/autocomplete';
import type { LineBadgeData } from '@/domain/routes';

interface SearchItemProps {
    icon: React.ReactNode;
    title?: string;
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
                <span className="inline-flex items-center justify-center h-4.5 px-1 min-w-4.5 rounded-badge bg-fill-2 text-muted-foreground type-micro mr-1.5">
                    +{uniqueLines.length - 5}
                </span>
            )}
        </>
    );
};

/** A search result's text, the same on the desktop dropdown and the phone's list. */
export const SearchRowBody = ({ title, subtitle, lines }: Pick<SearchItemProps, 'title' | 'subtitle' | 'lines'>) => (
    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        {title && (
            <span className="text-foreground type-group truncate">
                {title}
            </span>
        )}
        {(subtitle || (lines && lines.length > 0)) && (
            <div className="flex flex-wrap items-center gap-y-1">
                <LineBadges lines={lines} />
                {subtitle && (
                    <span className="text-muted-foreground type-note truncate">
                        {subtitle}
                    </span>
                )}
            </div>
        )}
    </div>
);

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
                'row-hover w-full px-3.5 py-2 min-h-11 flex items-center gap-3 select-none type-row [&_svg]:pointer-events-none [&_svg]:shrink-0',
                variant === 'primary' && 'text-tint-mint'
            )}
        >
            <div className={cn(
                'shrink-0 flex items-center justify-center',
                variant === 'primary' ? 'text-tint-mint' : highlight ? 'text-favorite' : 'text-muted-foreground'
            )}>
                {icon}
            </div>
            <SearchRowBody title={title} subtitle={subtitle} lines={lines} />
        </Autocomplete.Item>
    );
};
