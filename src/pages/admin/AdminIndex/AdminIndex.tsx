import { Link } from "wouter";
import { AdminLayout } from "../AdminLayout";
import { Database, MessageSquare } from "lucide-react";

export const AdminIndex = () => {
  return (
    <AdminLayout title="Admin Dashboard" backUrl="/" contentClassName="p-4 sm:p-8 max-w-4xl mx-auto w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/admin/explorer" className="group flex flex-col gap-3.5 p-6 bg-card/70 backdrop-blur-md border border-border/40 rounded-2xl shadow-xs hover:border-primary/40 hover:bg-card hover:shadow-md transition-all cursor-pointer h-full">
            <div className="bg-primary/10 border border-primary/20 w-12 h-12 rounded-xl flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
              <Database size={22} />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">Feed Explorer</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Inspect live GTFS RT feed entity payloads and system feeds in raw JSON format.
              </p>
            </div>
        </Link>
        <Link href="/admin/feedback" className="group flex flex-col gap-3.5 p-6 bg-card/70 backdrop-blur-md border border-border/40 rounded-2xl shadow-xs hover:border-primary/40 hover:bg-card hover:shadow-md transition-all cursor-pointer h-full">
            <div className="bg-primary/10 border border-primary/20 w-12 h-12 rounded-xl flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
              <MessageSquare size={22} />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">Feedback Hub</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Review user bug reports, feature requests, and crash stack traces with diagnostic payloads.
              </p>
            </div>
        </Link>
      </div>
    </AdminLayout>
  );
};
