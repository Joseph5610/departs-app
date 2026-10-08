import type React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PanelTab<T extends string> {
    value: T;
    icon: React.ReactNode;
    label: string;
    count?: number;
    testId?: string;
}

interface PanelTabsProps<T extends string> {
    value: T;
    onChange: (value: T) => void;
    tabs: readonly [PanelTab<T>, PanelTab<T>];
}

/** The two-tab pill bar under a detail panel's title. */
export function PanelTabs<T extends string>({ value, onChange, tabs }: PanelTabsProps<T>) {
    return (
        <div className="pt-1 pb-2 px-4 shrink-0">
            <Tabs value={value} onValueChange={(v) => onChange(v as T)}>
                <TabsList variant="pill" className="w-full grid grid-cols-2">
                    {tabs.map(tab => (
                        <TabsTrigger key={tab.value} value={tab.value} data-testid={tab.testId} className="cursor-pointer gap-1.5 text-xs font-semibold">
                            {tab.icon}
                            <span>{tab.label}</span>
                            {tab.count !== undefined && <span className="tabular-nums opacity-60">{tab.count}</span>}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
        </div>
    );
}
