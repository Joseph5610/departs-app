import React from 'react';
import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface AdminLayoutProps {
  children: React.ReactNode;
  title: React.ReactNode;
  backUrl?: string;
  headerActions?: React.ReactNode;
  contentClassName?: string;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ 
  children, 
  title, 
  backUrl = '/admin',
  headerActions,
  contentClassName = 'p-4 sm:p-6'
}) => {
  return (
    <div className="flex flex-col h-dvh bg-background text-foreground overflow-hidden">
      {/* Header Area */}
      <div className="flex-none border-b border-border bg-card p-3 shadow-sm z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={backUrl}>
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9" aria-label="Go back">
              <ArrowLeft size={20} />
            </Button>
          </Link>
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        </div>

        {/* Dynamic header actions (tabs, buttons, etc) */}
        {headerActions && (
          <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-2">
            {headerActions}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className={`flex-1 overflow-auto bg-muted/10 ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
};
