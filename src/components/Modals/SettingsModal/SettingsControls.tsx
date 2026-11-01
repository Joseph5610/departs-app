import { SectionHeading } from '@/components/SectionHeading';
import React from 'react';
import { cn } from '@/lib/cn';
import { Switch } from '@/components/ui/switch';
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions } from '@/components/ui/item';

/** A row's title and explanation. */
export const RowText = ({ title, description, className }: { title: string; description?: string; className?: string }) => (
    <ItemContent className={cn("min-w-0 gap-0", className)}>
        <ItemTitle className="w-full type-row text-foreground">{title}</ItemTitle>
        {description && <ItemDescription className="line-clamp-none type-note">{description}</ItemDescription>}
    </ItemContent>
);

interface FilterGroupProps {
    title: string;
    /** Shown right of the title, such as an "All" link. */
    action?: React.ReactNode;
    children: React.ReactNode;
}

/** A row's nested filters: a small heading over a wrapping set of chips. */
export const FilterGroup = ({ title, action, children }: FilterGroupProps) => (
    <div className="flex flex-col gap-2">
        <div className="flex min-h-4.5 items-center justify-between">
            <SectionHeading className="px-0">{title}</SectionHeading>
            {action}
        </div>
        <div className="flex flex-wrap gap-x-1.5 gap-y-2">{children}</div>
    </div>
);

/** What a row reveals while its switch is on, aligned to the row's text. */
export const RowDetails = ({ children }: { children: React.ReactNode }) => (
    <div className="row-separator flex flex-col gap-3.5 py-2.5 pr-3.5 pl-11.5 motion-safe:animate-in motion-safe:fade-in">{children}</div>
);

interface ToggleSectionProps {
    title: string;
    description: string;
    icon: React.ElementType;
    isChecked: boolean;
    onToggle: (val: boolean) => void;
    /** Revealed below the switch while it is on. */
    children?: React.ReactNode;
}

/** A row of a settings group with a switch; its children appear underneath while the switch is on. */
export const ToggleSection = ({ title, description, icon: Icon, isChecked, onToggle, children }: ToggleSectionProps) => (
    <>
        <Item
            variant="row"
            size="none"
            render={<button onClick={() => onToggle(!isChecked)} />}
        >
            <ItemMedia variant="rowIcon" className="text-muted-foreground">
                <Icon strokeWidth={1.75} />
            </ItemMedia>
            <RowText title={title} description={description} />
            <ItemActions>
                <Switch checked={isChecked} onCheckedChange={onToggle} />
            </ItemActions>
        </Item>
        {isChecked && children}
    </>
);
