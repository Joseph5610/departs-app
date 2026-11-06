import type React from 'react';
import { cn } from '@/lib/cn';

interface HeroNoticeProps {
    icon: React.ElementType;
    title: string;
    description: string;
    /** The icon's and title's colour. */
    tone: string;
    /** The description's colour. */
    descriptionTone: string;
    children?: React.ReactNode;
}

/** A note about the trip inside the vehicle hero: why it has no position, or that it ended. */
export const HeroNotice = ({ icon: Icon, title, description, tone, descriptionTone, children }: HeroNoticeProps) => (
    <div className="flex items-start gap-2.5">
        <Icon size={16} strokeWidth={2} className={cn("shrink-0", tone)} />
        <div className="flex min-w-0 flex-col gap-1">
            <span className={cn("type-group", tone)}>{title}</span>
            <span className={cn("type-note leading-snug font-medium", descriptionTone)}>{description}</span>
            {children}
        </div>
    </div>
);
