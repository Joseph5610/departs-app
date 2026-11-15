import { useRef } from 'react';
import { cn } from '@/lib/cn';

interface SegmentedControlProps<T extends string> {
    value: T;
    onChange: (value: T) => void;
    options: ReadonlyArray<{ value: T; label: React.ReactNode; testId?: string }>;
    size?: 'sm' | 'md';
    /** Takes the full width instead of fitting its options. */
    fill?: boolean;
    className?: string;
}

const SIZE_CLASSES = {
    sm: { group: 'h-control-sm shrink-0', item: 'hit-target px-2.5 whitespace-nowrap' },
    md: { group: 'h-control-lg', item: 'px-4 whitespace-nowrap' },
};

/** A switch between a few mutually exclusive options, whose thumb slides between them and can be dragged; `sm` fits inside a row. */
export function SegmentedControl<T extends string>({ value, onChange, options, size = 'md', fill = false, className }: SegmentedControlProps<T>) {
    const classes = SIZE_CLASSES[size];
    const selected = options.findIndex(option => option.value === value);
    const dragging = useRef(false);

    const dragTo = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragging.current) return;
        const box = e.currentTarget.getBoundingClientRect();
        const index = Math.floor(((e.clientX - box.left) / box.width) * options.length);
        const option = options[Math.min(options.length - 1, Math.max(0, index))];
        if (option.value === value) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        onChange(option.value);
    };

    return (
        <div
            data-base-ui-swipe-ignore
            onPointerDown={(e) => { dragging.current = e.target instanceof Element && e.target.closest('[aria-pressed="true"]') !== null; }}
            onPointerMove={dragTo}
            onPointerUp={() => { dragging.current = false; }}
            onPointerCancel={() => { dragging.current = false; }}
            className={cn('relative grid auto-cols-fr grid-flow-col touch-pan-y bg-fill-2 p-0.5 rounded-full', classes.group, fill && 'w-full', className)}
        >
            {selected >= 0 && (
                <span
                    aria-hidden="true"
                    className="absolute inset-y-0.5 left-0.5 w-[calc((100%-4px)/var(--segments))] translate-x-[calc(var(--segment)*100%)] rounded-full bg-segment-selected motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-[cubic-bezier(.32,.72,0,1)]"
                    style={{ '--segments': options.length, '--segment': selected } as React.CSSProperties}
                />
            )}
            {options.map(option => (
                <button
                    key={option.value}
                    type="button"
                    aria-pressed={value === option.value}
                    onClick={() => onChange(option.value)}
                    data-testid={option.testId}
                    className={cn(
                        'relative flex items-center justify-center gap-1.5 rounded-full type-group tabular-nums cursor-pointer transition-colors duration-200',
                        classes.item,
                        fill && 'px-1.5',
                        value === option.value ? 'text-on-segment-selected' : 'text-muted-foreground hover:text-foreground'
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
