import React from 'react';
import { cn } from '@/lib/utils';
import { Box } from '@/components/ui/layout';
import { Badge } from '@/components/ui/badge';

interface StatusPillProps {
    label: string;
    icon?: React.ReactNode;
    variant?: 'success' | 'danger' | 'info' | 'warning' | 'neutral';
}

/**
 * StatusPill
 *
 * Re-implemented with shadcn Badge for consistency.
 */
export const StatusPill: React.FC<StatusPillProps> = ({ label, icon, variant = 'neutral' }) => {
    const variants = {
        success: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/10 hover:bg-emerald-500/20',
        danger: 'bg-rose-500/20 text-rose-400 border-rose-500/10 hover:bg-rose-500/20',
        info: 'bg-sky-500/20 text-sky-400 border-sky-500/10 hover:bg-sky-500/20',
        warning: 'bg-amber-500/20 text-amber-400 border-amber-500/10 hover:bg-amber-500/20',
        neutral: 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/30',
    };

    return (
        <Badge variant="outline" className={cn(
            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors duration-200 gap-1.5",
            variants[variant]
        )}>
            {icon && <Box className="shrink-0">{icon}</Box>}
            <span className="whitespace-nowrap">{label}</span>
        </Badge>
    );
};
