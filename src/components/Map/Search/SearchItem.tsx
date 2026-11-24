import { cn } from '@/lib/cn';
import { LineBadges } from '@/components/LineBadges';
import { Autocomplete } from '@base-ui/react/autocomplete';
import type { SearchRow } from './searchSections';

/** A search result's text, the same on the desktop dropdown and the phone's list. */
export const SearchRowBody = ({ row: { title, subtitle, lines } }: { row: SearchRow }) => (
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

/** A row of the desktop dropdown; Enter on the keyboard-highlighted row selects it. */
export const SearchItem = ({ row }: { row: SearchRow }) => (
    <Autocomplete.Item
        value={row.testId}
        onClick={row.onSelect}
        data-testid={row.testId}
        className={cn(
            'row-hover w-full px-3.5 py-2 min-h-11 flex items-center gap-3 select-none type-row [&_svg]:pointer-events-none [&_svg]:shrink-0',
            row.isPrimary && 'text-tint-mint'
        )}
    >
        <div className={cn('shrink-0 flex items-center justify-center', row.isPrimary ? 'text-tint-mint' : 'text-muted-foreground')}>
            {row.icon}
        </div>
        <SearchRowBody row={row} />
    </Autocomplete.Item>
);
