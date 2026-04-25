import React from 'react';
import { cn } from '@/lib/utils';
import { Box, Stack, Surface } from '@/components/ui/layout';
import { LINE_COLORS } from '@/config/stations';

interface SearchItemProps {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    metroLines?: string[];
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
export const SearchItem = ({ icon, title, subtitle, metroLines, onClick, variant = 'default', highlight = false, testId }: SearchItemProps) => (
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
            <Stack gap={0} className="min-w-0 flex-1">
                <span className="text-foreground font-medium line-clamp-2 leading-normal">
                    {title}
                    {metroLines?.map((line: string) => (
                        <span 
                            key={line} 
                            className="inline-flex items-center justify-center w-[15px] h-[15px] rounded-sm text-[10px] text-white font-black ml-1.5 align-baseline translate-y-[-1px]"
                            style={{ backgroundColor: LINE_COLORS[line as keyof typeof LINE_COLORS] }}
                        >
                            {line}
                        </span>
                    ))}
                </span>
                {subtitle && <span className="text-muted-foreground text-xs line-clamp-1 mt-0.5">{subtitle}</span>}
            </Stack>
        </button>
    </Surface>
);

SearchItem.displayName = 'SearchItem';
