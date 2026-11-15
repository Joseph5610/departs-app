import type React from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';

interface SearchFieldProps extends Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'className'> {
    value: string;
    onValueChange: (value: string) => void;
    /** The clear button's label; it shows while there is text. */
    clearLabel: string;
    /** Replaces clearing the text, e.g. to refocus the field too. */
    onClear?: () => void;
    /** A control between the icon and the text, such as what the search looks in. */
    lead?: React.ReactNode;
    className?: string;
}

/** The app's one search field in a sheet or panel: icon, text and a clear button in a 44px capsule. */
export const SearchField = ({ value, onValueChange, clearLabel, onClear, lead, className, ref, ...input }: SearchFieldProps) => (
    <label className={cn("flex h-11 min-w-0 items-center gap-2.25 rounded-full bg-field pr-1 pl-3.5", className)}>
        <SearchIcon size={18} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
        {lead}
        <input
            ref={ref}
            type="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            className="h-full min-w-0 flex-1 bg-transparent type-field text-foreground outline-none focus-visible:outline-none focus-visible:ring-0 placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
            {...input}
        />
        {value && (
            <Button type="button" variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground" onClick={onClear ?? (() => onValueChange(''))} aria-label={clearLabel}>
                <X size={16} strokeWidth={2} />
            </Button>
        )}
    </label>
);
