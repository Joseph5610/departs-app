import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions } from '@/components/ui/item';
import { cn } from 'cn';
import { IconToggle, type IconToggleProps } from '@/components/IconToggle';

export const SectionHeading = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest px-1">
        {children}
    </h3>
);

export const FilterHeading = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-center gap-2">
        <div className="w-1 h-1 rounded-full bg-primary" />
        <div className="text-muted-foreground text-[10px] uppercase font-bold tracking-[0.2em]">
            {children}
        </div>
    </div>
);

export const FilterButton = (props: Omit<IconToggleProps, 'className' | 'labelClassName'>) => (
    <IconToggle {...props} className="py-2.5 rounded-2xl text-sm" labelClassName="text-[10px] font-bold uppercase tracking-wider" />
);

interface ToggleSectionProps {
    title: string;
    description: string;
    icon: React.ElementType;
    isChecked: boolean;
    onToggle: (val: boolean) => void;
    /** Revealed below the switch while it is on. */
    children?: React.ReactNode;
    className?: string;
}

/** A settings card with a switch; its children expand underneath while the switch is on. */
export const ToggleSection = ({ title, description, icon: Icon, isChecked, onToggle, children, className }: ToggleSectionProps) => (
    <Card variant="subtle" size="none" className={className}>
        <Item
            variant="settings"
            size="none"
            className={cn(
                "w-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset border-0",
                isChecked && children ? "rounded-t-xl" : "rounded-xl"
            )}
            render={<button onClick={() => onToggle(!isChecked)} />}
        >
            <ItemMedia variant="icon" className={cn(isChecked ? "text-primary" : "text-muted-foreground")}>
                <Icon size={20} strokeWidth={1.5} />
            </ItemMedia>
            <ItemContent>
                <ItemTitle className="text-foreground">{title}</ItemTitle>
                <ItemDescription className="text-xs">{description}</ItemDescription>
            </ItemContent>
            <ItemActions>
                <Switch
                    checked={isChecked}
                    onCheckedChange={onToggle}
                    className="ml-3 sm:ml-4"
                />
            </ItemActions>
        </Item>

        {children && (
            <div
                className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out border-t border-border/50",
                    isChecked ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none border-t-0"
                )}
            >
                <div className="overflow-hidden flex flex-col">
                    {children}
                </div>
            </div>
        )}
    </Card>
);
