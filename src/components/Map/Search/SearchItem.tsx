import React from 'react';
import { cn } from '@/lib/utils';
import { Box, Stack, Surface } from '@/components/ui/layout';

interface SearchItemProps {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    onClick: () => void;
    variant?: 'default' | 'primary';
    highlight?: boolean;
    testId?: string;
}

/**
 * SearchItem
 *
 * A single row in the search dropdown. Supports default, primary (line filter),
 * and highlighted (favorite) visual variants.
 */
export const SearchItem = ({ icon, title, subtitle, onClick, variant = 'default', highlight = false, testId }: SearchItemProps) => (
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
            <Stack gap={0} className="min-w-0">
                <span className="text-foreground font-medium truncate">{title}</span>
                {subtitle && <span className="text-muted-foreground text-xs truncate">{subtitle}</span>}
            </Stack>
        </button>
    </Surface>
);

SearchItem.displayName = 'SearchItem';
