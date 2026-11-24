import { useTheme } from 'next-themes';
import { JsonView, darkStyles, defaultStyles } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/EmptyState';

/** The header's refresh button, spinning while a refetch runs. */
export const RefreshButton = ({ onRefresh, isRefreshing }: { onRefresh: () => void; isRefreshing: boolean }) => (
    <Button variant="secondary" size="icon-xs" onClick={onRefresh} disabled={isRefreshing} aria-label="Refresh" title="Refresh">
        <RefreshCw className={isRefreshing ? 'animate-spin' : undefined} />
    </Button>
);

/** A page's loading or failed state; a failure offers to try again. */
export const AdminStatus = ({ error, onRetry }: { error?: unknown; onRetry?: () => void }) => error ? (
    <EmptyState icon={AlertCircle} tone="error" title="Could not load" description={error instanceof Error ? error.message : String(error)}>
        {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button>}
    </EmptyState>
) : (
    <EmptyState icon={Loader2} title="Loading…" className="[&_svg]:animate-spin" />
);

/** A JSON tree in the app's theme, without the viewer's own background. */
export const JsonPanel = ({ data, shouldExpandNode }: { data: object; shouldExpandNode: (level: number) => boolean }) => {
    const { resolvedTheme } = useTheme();
    return (
        <div className="overflow-x-auto font-mono text-xs">
            <JsonView data={data} shouldExpandNode={shouldExpandNode} style={{ ...(resolvedTheme === 'light' ? defaultStyles : darkStyles), container: '' }} />
        </div>
    );
};
