import { cn } from '@/lib/utils';

interface SegmentedControlProps<T extends string> {
    value: T;
    onChange: (value: T) => void;
    options: ReadonlyArray<{ value: T; label: React.ReactNode }>;
    size?: 'sm' | 'md';
}

const SIZE_CLASSES = {
    sm: { group: 'shrink-0', item: 'text-[11px] px-2 py-0.5 transition-all shrink-0' },
    md: { group: 'border border-border/40', item: 'text-xs px-2.5 py-1 transition-colors' },
};

/** Small inline switch between a few mutually exclusive options. */
export function SegmentedControl<T extends string>({ value, onChange, options, size = 'md' }: SegmentedControlProps<T>) {
    const classes = SIZE_CLASSES[size];
    return (
        <div className={cn('flex items-center gap-0.5 bg-muted/30 p-0.5 rounded-lg', classes.group)}>
            {options.map(option => (
                <button
                    key={option.value}
                    type="button"
                    aria-pressed={value === option.value}
                    onClick={() => onChange(option.value)}
                    className={cn(
                        'rounded-md font-semibold cursor-pointer',
                        classes.item,
                        value === option.value
                            ? 'bg-background text-foreground shadow-2xs'
                            : 'text-muted-foreground hover:text-foreground'
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
