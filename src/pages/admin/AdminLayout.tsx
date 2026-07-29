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
      <div className="flex-none border-b border-border/40 bg-card/80 backdrop-blur-md px-4 py-3 z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={backUrl}>
            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 bg-foreground/5 hover:bg-foreground/10 border border-border/40 text-muted-foreground hover:text-foreground transition-colors cursor-pointer" aria-label="Go back">
              <ArrowLeft size={16} />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground">{title}</h1>
            <span className="text-[10px] font-extrabold uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md hidden sm:inline-block">
              Admin
            </span>
          </div>
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
