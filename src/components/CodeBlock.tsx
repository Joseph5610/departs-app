import type React from 'react';
import { cn } from '@/lib/cn';

/** Preformatted text on a nested fill: a snippet to copy, a payload or a stack trace. */
export const CodeBlock = ({ className, ...props }: React.ComponentProps<'pre'>) => (
    <pre className={cn("overflow-auto rounded-nested bg-fill p-3 font-mono type-meta text-muted-foreground", className)} {...props} />
);
