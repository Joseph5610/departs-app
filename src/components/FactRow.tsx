import type React from 'react';
import { Item } from '@/components/ui/item';

/** One fact in a grouped card: what it is on the left, its value on the right (stats, opening hours). */
export const FactRow = ({ label, value }: { label: React.ReactNode; value: React.ReactNode }) => (
    <Item variant="row" size="none" className="justify-between gap-3 [--row-sep:0.875rem]">
        <span className="flex min-w-0 items-center truncate type-row text-muted-foreground">{label}</span>
        <span className="min-w-0 truncate type-headsign tabular-nums text-foreground">{value}</span>
    </Item>
);
