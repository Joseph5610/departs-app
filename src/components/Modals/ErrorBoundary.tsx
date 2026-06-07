import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty';

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
                <div className="flex items-center justify-center fixed inset-0 bg-background p-6 z-[9999]">
                    <Card variant="subtle" className="border-destructive/20 max-w-md w-full">
                        <Empty className="py-8 border-none">
                            <EmptyHeader>
                                <EmptyMedia
                                    variant="icon"
                                    className="size-14 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive shadow-[0_0_20px_rgba(220,38,38,0.1)] [&_svg:not([class*='size-'])]:size-7"
                                >
                                    <AlertCircle strokeWidth={1.5} />
                                </EmptyMedia>
                                <EmptyTitle className="text-xl font-bold text-foreground">
                                    Oops, something went wrong
                                </EmptyTitle>
                                <EmptyDescription className="text-sm">
                                    The application encountered an unexpected error. Please try refreshing.
                                </EmptyDescription>
                            </EmptyHeader>
                            <EmptyContent className="w-full flex flex-col gap-6 pt-6 px-6">
                                <Button
                                    size="xl"
                                    variant="default"
                                    onClick={() => window.location.reload()}
                                    className="w-full h-auto py-4 font-bold flex items-center justify-center gap-2"
                                >
                                    <RefreshCcw size={20} strokeWidth={1.5} />
                                    Refresh Application
                                </Button>

                                {/* Enhanced debug info */}
                                <div className="pt-4 border-t border-border text-left overflow-hidden w-full">
                                    <p className="text-destructive text-[10px] font-mono leading-tight break-all mb-2">
                                        {this.state.error?.toString()}
                                    </p>
                                    {this.state.errorInfo && (
                                        <pre className="text-muted-foreground text-[8px] font-mono leading-tight whitespace-pre-wrap max-h-40 overflow-y-auto w-full custom-scrollbar">
                                            {this.state.errorInfo.componentStack}
                                        </pre>
                                    )}
                                </div>
                            </EmptyContent>
                        </Empty>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}
