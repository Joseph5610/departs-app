import type React from 'react';
import { Item } from '@/components/ui/item';

/** One fact of a stats card: what it counts on the left, the value on the right. */
export const StatRow = ({ label, value }: { label: React.ReactNode; value: React.ReactNode }) => (
    <Item variant="row" size="none" className="justify-between gap-3 px-3.5 [--row-sep:0.875rem]">
        <span className="flex min-w-0 items-center truncate type-row text-muted-foreground">{label}</span>
        <span className="shrink-0 type-headsign tabular-nums text-foreground">{value}</span>
    </Item>
);
