import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

/** The app's one close glyph, for every close and dismiss button: 14px, or 16px on a 44px control. */
export const CloseIcon = ({ large = false, className }: { large?: boolean; className?: string }) => (
    <X strokeWidth={2.5} className={cn(large ? 'size-4' : 'size-3.5', className)} aria-hidden="true" />
);
