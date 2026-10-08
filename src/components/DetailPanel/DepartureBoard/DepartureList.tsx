import type React from 'react';
import { cn } from 'cn';
import type { Departure } from '@/types';

interface DepartureListProps {
    departures: Departure[];
    children: (departure: Departure) => React.ReactNode;
}

/** Departure rows divided and striped as on the departure board. */
export const DepartureList = ({ departures, children }: DepartureListProps) => (
    <div className="flex flex-col divide-y divide-black/5 dark:divide-white/5">
        {departures.map((dep, idx) => (
            <div
                key={dep.tripId ? `${dep.tripId}-${dep.scheduled}` : idx}
                className={cn(
                    "transition-colors hover:bg-black/2.5 dark:hover:bg-white/4",
                    idx % 2 === 1 && "bg-black/1.5 dark:bg-white/2"
                )}
            >
                {children(dep)}
            </div>
        ))}
    </div>
);
