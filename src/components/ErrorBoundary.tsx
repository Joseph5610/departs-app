import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { Box, Surface } from '@/components/ui/layout';
import { Button } from '@/components/ui/button';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
    errorInfo?: ErrorInfo;
}

/**
 * ErrorBoundary
 *
 * Re-architected with semantic layout components.
 * Enhanced to show error details in all builds for debugging.
 */
export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <Box center className="fixed inset-0 bg-background p-6 z-[9999]">
                    <Surface variant="glassy" padding="xl" className="max-w-md w-full border-destructive/20 rounded-[32px] flex flex-col gap-0 items-center">
                        <Box center className="w-16 h-16 bg-destructive/10 rounded-2xl mb-6 shrink-0">
                            <AlertCircle className="text-destructive" size={32} />
                        </Box>
                        <h1 className="text-foreground text-2xl font-bold mb-2">Oops, something went wrong</h1>
                        <p className="text-muted-foreground text-sm mb-8 leading-relaxed text-center">
                            The application encountered an unexpected error. Please try refreshing.
                        </p>

                        <Button
                            size="xl"
                            variant="default"
                            onClick={() => window.location.reload()}
                            className="w-full h-auto py-4 font-bold flex items-center justify-center gap-2"
                        >
                            <RefreshCcw size={18} />
                            Refresh Application
                        </Button>

                        {/* Enhanced debug info (temporary) */}
                        <Box className="mt-8 pt-6 border-t border-border text-left overflow-hidden w-full">
                            <p className="text-destructive text-[10px] font-mono leading-tight break-all mb-2">
                                {this.state.error?.toString()}
                            </p>
                            {this.state.errorInfo && (
                                <pre className="text-muted-foreground text-[8px] font-mono leading-tight whitespace-pre-wrap max-h-40 overflow-y-auto w-full">
                                    {this.state.errorInfo.componentStack}
                                </pre>
                            )}
                        </Box>
                    </Surface>
                </Box>
            );
        }

        return this.props.children;
    }
}
