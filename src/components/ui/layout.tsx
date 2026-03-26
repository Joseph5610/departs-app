import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Slot Component
 * A minimal replacement for @radix-ui/react-slot to avoid the dependency.
 * It merges its own props with the props of its first child.
 */
const Slot = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }>(
    ({ children, ...props }, ref) => {
        if (!React.isValidElement(children)) return null;

        const child = children as React.ReactElement<React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> }>;
        const childProps = child.props;

        return React.cloneElement(child, {
            ...props,
            ...childProps,
            className: cn(props.className, childProps?.className),
            ref: (node: HTMLElement) => {
                if (typeof ref === 'function') {
                    ref(node);
                } else if (ref && 'current' in ref) {
                    (ref as React.MutableRefObject<HTMLElement | null>).current = node;
                }

                const childRef = child.props.ref;
                if (typeof childRef === 'function') {
                    childRef(node);
                } else if (childRef && 'current' in childRef) {
                    (childRef as React.MutableRefObject<HTMLElement | null>).current = node;
                }
            },
        });
    }
);
Slot.displayName = 'Slot';

/**
 * Box Component
 * Base block-level element with optional padding and centering.
 */
const boxVariants = cva('', {
    variants: {
        padding: {
            none: 'p-0',
            xs: 'p-1',
            sm: 'p-2',
            md: 'p-4',
            lg: 'p-6',
            xl: 'p-8',
        },
        center: {
            true: 'flex items-center justify-center',
        },
    },
    defaultVariants: {
        padding: 'none',
    },
});

interface BoxProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof boxVariants> {
    asChild?: boolean;
}

export const Box = React.forwardRef<HTMLDivElement, BoxProps>(
    ({ className, padding, center, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : 'div';
        return (
            <Comp
                ref={ref}
                className={cn(boxVariants({ padding, center }), className)}
                {...props}
            />
        );
    }
);
Box.displayName = 'Box';

/**
 * Stack & HStack Components
 * Flexbox-based layout components.
 */
const stackVariants = cva('flex', {
    variants: {
        direction: {
            col: 'flex-col',
            row: 'flex-row',
        },
        align: {
            start: 'items-start',
            center: 'items-center',
            end: 'items-end',
            stretch: 'items-stretch',
        },
        justify: {
            start: 'justify-start',
            center: 'justify-center',
            end: 'justify-end',
            between: 'justify-between',
        },
        gap: {
            0: 'gap-0',
            1: 'gap-1',
            2: 'gap-2',
            3: 'gap-3',
            4: 'gap-4',
            6: 'gap-6',
            8: 'gap-8',
        },
    },
    defaultVariants: {
        direction: 'col',
        gap: 2,
    },
});

interface StackProps
    extends BoxProps,
        VariantProps<typeof stackVariants> {}

export const Stack = React.forwardRef<HTMLDivElement, StackProps>(
    ({ className, direction, align, justify, gap, padding, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : 'div';
        return (
            <Comp
                ref={ref}
                className={cn(stackVariants({ direction, align, justify, gap }), boxVariants({ padding }), className)}
                {...props}
            />
        );
    }
);
Stack.displayName = 'Stack';

export const HStack = React.forwardRef<HTMLDivElement, StackProps>(
    ({ className, direction = 'row', align = 'center', ...props }, ref) => (
        <Stack
            ref={ref}
            direction={direction}
            align={align}
            className={className}
            {...props}
        />
    )
);
HStack.displayName = 'HStack';

/**
 * Surface Component
 * Containers with backgrounds, borders, and shadows.
 */
const surfaceVariants = cva('rounded-3xl border transition-all', {
    variants: {
        variant: {
            default: 'bg-background border-border',
            muted: 'bg-muted border-border',
            glassy: 'glassy',
            tinted: 'glassy-tinted',
            subtle: 'bg-muted/30 border-border',
            ghost: 'bg-transparent border-transparent',
        },
        padding: {
            none: 'p-0',
            xs: 'p-1',
            sm: 'p-2',
            md: 'p-3.5 sm:p-4',
            lg: 'p-6',
            xl: 'p-8',
        },
    },
    defaultVariants: {
        variant: 'glassy',
        padding: 'none',
    },
});

interface SurfaceProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof surfaceVariants> {
    asChild?: boolean;
}

export const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
    ({ className, variant, padding, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : 'div';
        return (
            <Comp
                ref={ref}
                className={cn(surfaceVariants({ variant, padding }), className)}
                {...props}
            />
        );
    }
);
Surface.displayName = 'Surface';

/**
 * Overlay Component
 * Fixed position containers.
 */
export const Overlay = ({
    position = 'top-left',
    children,
    className,
    ...props
}: {
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center';
    children: React.ReactNode;
    className?: string;
} & React.HTMLAttributes<HTMLDivElement>) => {
    const positions = {
        'top-left': 'top-0 left-0',
        'top-right': 'top-0 right-0',
        'bottom-left': 'bottom-0 left-0',
        'bottom-right': 'bottom-0 right-0',
        'top-center': 'top-0 left-1/2 -translate-x-1/2',
    };

    return (
        <div 
            className={cn('fixed z-40 pointer-events-none', positions[position], className)}
            {...props}
        >
            <div className="pointer-events-auto">{children}</div>
        </div>
    );
};
