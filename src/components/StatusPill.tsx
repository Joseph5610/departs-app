import React from 'react';
import { cn } from '@/lib/utils';

interface StatusPillProps {
    label: string;
    icon?: React.ReactNode;
    variant?: 'success' | 'danger' | 'info' | 'warning' | 'neutral';
}

export const StatusPill: React.FC<StatusPillProps> = ({ label, icon, variant = 'neutral' }) => {
    const variants = {
        success: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/10',
        danger: 'bg-rose-500/20 text-rose-400 border-rose-500/10',
        info: 'bg-sky-500/20 text-sky-400 border-sky-500/10',
        warning: 'bg-amber-500/20 text-amber-400 border-amber-500/10',
        neutral: 'bg-muted/30 text-muted-foreground border-border',
    };

    return (
        <div className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-colors duration-200",
            variants[variant]
        )}>
            {icon && <span className="shrink-0">{icon}</span>}
            <span className="whitespace-nowrap">{label}</span>
        </div>
    );
};
