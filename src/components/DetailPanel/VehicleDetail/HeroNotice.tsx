import type React from 'react';
import { cn } from '@/lib/cn';

interface HeroNoticeProps {
    icon: React.ElementType;
    title: string;
    description: string;
    /** The icon's and title's colour. */
    tone: string;
    children?: React.ReactNode;
}

/** A note about the trip inside the vehicle hero: why it has no position, or that it ended. */
export const HeroNotice = ({ icon: Icon, title, description, tone, children }: HeroNoticeProps) => (
    <div className="flex items-start gap-2.5">
        <Icon size={17} strokeWidth={2} className={cn("mt-px shrink-0", tone)} />
        <div className="flex min-w-0 flex-col gap-0.5">
            <span className={cn("type-headsign", tone)}>{title}</span>
            <span className="type-meta text-muted-foreground">{description}</span>
            {children}
        </div>
    </div>
);
