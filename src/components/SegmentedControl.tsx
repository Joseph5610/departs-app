import { cn } from '@/lib/cn';

interface SegmentedControlProps<T extends string> {
    value: T;
    onChange: (value: T) => void;
    options: ReadonlyArray<{ value: T; label: React.ReactNode }>;
    size?: 'sm' | 'md';
}

const SIZE_CLASSES = {
    sm: { group: 'h-8 shrink-0', item: 'px-2.75 shrink-0' },
    md: { group: 'h-11', item: 'px-4' },
};

/** A switch between a few mutually exclusive options; `sm` fits inside a row. */
export function SegmentedControl<T extends string>({ value, onChange, options, size = 'md' }: SegmentedControlProps<T>) {
    const classes = SIZE_CLASSES[size];
    return (
        <div className={cn('flex items-stretch bg-fill-2 p-0.5 rounded-full', classes.group)}>
            {options.map(option => (
                <button
                    key={option.value}
                    type="button"
                    aria-pressed={value === option.value}
                    onClick={() => onChange(option.value)}
                    className={cn(
                        'flex items-center justify-center rounded-full text-body-sm font-semibold cursor-pointer transition-colors',
                        classes.item,
                        value === option.value
                            ? 'bg-segment-selected text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
