import React from 'react';
import { cn } from '@/lib/cn';
import { LineBadges } from '@/components/LineBadges';
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

/** A search result's text, the same on the desktop dropdown and the phone's list. */
export const SearchRowBody = ({ title, subtitle, lines }: Pick<SearchItemProps, 'title' | 'subtitle' | 'lines'>) => (
    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        {title && (
            <span className="text-foreground type-headsign truncate">
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
