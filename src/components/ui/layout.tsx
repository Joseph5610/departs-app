import React from 'react';
import { cn } from '@/lib/utils';

interface LayoutProps extends React.HTMLAttributes<HTMLDivElement> {
    children?: React.ReactNode;
}

export const Box = React.forwardRef<HTMLDivElement, LayoutProps>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn(className)} {...props} />
    )
);
Box.displayName = 'Box';

export const Stack = React.forwardRef<HTMLDivElement, LayoutProps>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn("flex flex-col gap-2", className)} {...props} />
    )
);
Stack.displayName = 'Stack';

export const HStack = React.forwardRef<HTMLDivElement, LayoutProps>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn("flex flex-row items-center gap-2", className)} {...props} />
    )
);
HStack.displayName = 'HStack';

export const Overlay = ({
    position = 'top-left',
    children,
    className
}: {
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center';
    children: React.ReactNode;
    className?: string;
}) => {
    const positions = {
        'top-left': 'top-0 left-0',
        'top-right': 'top-0 right-0',
        'bottom-left': 'bottom-0 left-0',
        'bottom-right': 'bottom-0 right-0',
        'top-center': 'top-0 left-1/2 -translate-x-1/2',
    };

    return (
        <div className={cn("fixed z-10 pointer-events-none", positions[position], className)}>
            <div className="pointer-events-auto">
                {children}
            </div>
        </div>
    );
};

export const Surface = React.forwardRef<HTMLDivElement, LayoutProps>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn(
                "bg-background/95 backdrop-blur-md border border-border rounded-3xl shadow-2xl",
                className
            )}
            {...props}
        />
    )
);
Surface.displayName = 'Surface';
