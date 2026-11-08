import type React from 'react';
import { SegmentedControl } from '@/components/SegmentedControl';

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

/** The two-tab switch under a detail panel's title. */
export function PanelTabs<T extends string>({ value, onChange, tabs }: PanelTabsProps<T>) {
    return (
        <div className="shrink-0 px-(--panel-gutter) pb-2">
            <SegmentedControl
                fill
                value={value}
                onChange={onChange}
                options={tabs.map(tab => ({
                    value: tab.value,
                    testId: tab.testId,
                    label: (
                        <>
                            {tab.icon}
                            <span>{tab.label}</span>
                            {tab.count !== undefined && <span className="opacity-60">{tab.count}</span>}
                        </>
                    ),
                }))}
            />
        </div>
    );
}
