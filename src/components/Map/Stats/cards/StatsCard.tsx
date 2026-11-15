import type React from 'react';
import { cn } from '@/lib/cn';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StatsCardProps {
    icon: React.ElementType;
    title: string;
    /** Colours the icon where it states a status; neutral otherwise. */
    iconClassName?: string;
    className?: string;
    /** Content reaching the card's edges, such as rows; it brings its own padding. */
    flush?: boolean;
    children: React.ReactNode;
}

/** A titled card of the statistics panel. */
export const StatsCard = ({ icon: Icon, title, iconClassName = 'text-muted-foreground', className, flush = false, children }: StatsCardProps) => (
    <Card size="none" className={className}>
        <CardHeader className="p-3.5 pb-2">
            <CardTitle className="flex items-center gap-2 type-row">
                <Icon size={16} className={iconClassName} />
                <span>{title}</span>
            </CardTitle>
        </CardHeader>
        <CardContent className={cn(flush ? "p-0" : "p-3.5 pt-0")}>{children}</CardContent>
    </Card>
);
