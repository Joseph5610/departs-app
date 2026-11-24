import type React from 'react';
import { Link } from 'wouter';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/cn';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface AdminLayoutProps {
    children: React.ReactNode;
    title: string;
    backUrl?: string;
    headerActions?: React.ReactNode;
    contentClassName?: string;
}

/** An admin page: a bar with back, title and actions over a scrolling, centred content column. */
export const AdminLayout = ({ children, title, backUrl = '/admin', headerActions, contentClassName }: AdminLayoutProps) => (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        <header className="flex shrink-0 items-center gap-3 border-b border-sep px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
            <Link href={backUrl} aria-label="Back" className={buttonVariants({ variant: 'secondary', size: 'icon-xs' })}>
                <ChevronLeft strokeWidth={2} />
            </Link>
            <h1 className="min-w-0 truncate type-title">{title}</h1>
            <Badge variant="label">Admin</Badge>
            {headerActions && <div className="ml-auto flex shrink-0 items-center gap-2">{headerActions}</div>}
        </header>
        <main className={cn("mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-4 overflow-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6", contentClassName)}>
            {children}
        </main>
    </div>
);
