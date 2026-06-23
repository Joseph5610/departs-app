import { Link } from "wouter";
import { AdminLayout } from "../AdminLayout";
import { Database, MessageSquare } from "lucide-react";

export const AdminIndex = () => {
  return (
    <AdminLayout title="Admin Dashboard" backUrl="/" contentClassName="p-4 sm:p-8 max-w-4xl mx-auto w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/admin/explorer" className="flex flex-col gap-3 p-6 bg-card border border-border rounded-xl shadow-sm hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer h-full">
            <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center text-primary mb-2">
              <Database size={24} />
            </div>
            <h2 className="text-xl font-semibold">Feed Explorer</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Explore raw GTFS RT feed data and internal system state for debugging and monitoring.
            </p>
        </Link>
        <Link href="/admin/feedback" className="flex flex-col gap-3 p-6 bg-card border border-border rounded-xl shadow-sm hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer h-full">
            <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center text-primary mb-2">
              <MessageSquare size={24} />
            </div>
            <h2 className="text-xl font-semibold">Feedback Hub</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              View and manage user feedback, bug reports, and crash diagnostics.
            </p>
        </Link>
      </div>
    </AdminLayout>
  );
};
