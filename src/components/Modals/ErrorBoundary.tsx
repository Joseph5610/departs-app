import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCcw, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import { apiFetch } from '@/lib/api-client';
import { getDiagnosticSnapshot } from '@/hooks/features/useDiagnosticData';
import { Button } from '@/components/ui/button';

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
        if (this.state.hasError && this.state.error) {
            return <ErrorFallback error={this.state.error} errorInfo={this.state.errorInfo} />;
        }

        return this.props.children;
    }
}

function ErrorFallback({ error, errorInfo }: { error: Error; errorInfo?: ErrorInfo }) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

    const handleReportCrash = async () => {
        if (!turnstileToken) return;
        setIsSubmitting(true);
        setSubmitError(null);
        try {
            const diagnostics = getDiagnosticSnapshot();
            diagnostics.crashInfo = {
                errorName: error.name,
                errorMessage: error.message,
                errorStack: error.stack,
                componentStack: errorInfo?.componentStack || undefined,
            };

            const payload = {
                type: 'crash',
                message: `${error.name}: ${error.message}`,
                includeDiagnostics: true,
                diagnostics,
                turnstileToken,
            };

            await apiFetch('/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            setIsSubmitted(true);
        } catch (e) {
            console.error('Failed to send crash report:', e);
            setSubmitError(e instanceof Error ? e.message : 'Failed to send report. Please check console.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <div className="w-full max-w-md bg-card border border-border shadow-2xl rounded-3xl overflow-hidden ring-1 ring-black/5">
                <Empty className="py-8">
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
                    <EmptyContent className="w-full flex flex-col gap-4 pt-4 px-6">
                        <Button
                            size="lg"
                            variant="default"
                            onClick={() => window.location.reload()}
                            className="w-full font-bold flex items-center justify-center gap-2 rounded-xl shadow-sm"
                        >
                            <RefreshCcw size={18} strokeWidth={2} />
                            Refresh Application
                        </Button>

                        {!isSubmitted ? (
                            <div className="flex flex-col gap-2 w-full">
                                <Button
                                    size="lg"
                                    variant="outline"
                                    onClick={handleReportCrash}
                                    disabled={!turnstileToken || isSubmitting}
                                    className="w-full font-bold flex items-center justify-center gap-2 rounded-xl border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="animate-spin" size={18} strokeWidth={2} />
                                            Sending Report...
                                        </>
                                    ) : (
                                        <>
                                            <Send size={18} strokeWidth={2} />
                                            Send Crash Report
                                        </>
                                    )}
                                </Button>
                                {submitError && (
                                    <div className="text-destructive text-sm text-center font-medium mt-1 bg-destructive/10 py-2 rounded-lg">
                                        {submitError}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-2 text-sm text-foreground font-bold h-11 bg-muted/40 rounded-xl w-full border border-border animate-in fade-in slide-in-from-bottom-2 duration-300 shadow-sm">
                                <CheckCircle2 size={18} strokeWidth={2} className="text-primary" />
                                Report successfully sent.
                            </div>
                        )}

                        <div className="flex justify-center w-full mt-2">
                            <Turnstile
                                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'}
                                onSuccess={setTurnstileToken}
                                onError={() => setTurnstileToken(null)}
                                onExpire={() => setTurnstileToken(null)}
                            />
                        </div>

                        {/* Enhanced debug info */}
                        <div className="mt-4 pt-4 border-t border-border/50 text-left w-full flex flex-col gap-2">
                            <p className="text-destructive text-xs font-mono leading-relaxed break-all font-semibold">
                                {error?.toString()}
                            </p>
                            {errorInfo && (
                                <div className="max-h-48 overflow-y-auto overflow-x-auto custom-scrollbar w-full">
                                    <pre className="text-muted-foreground/70 text-[10px] font-mono leading-relaxed whitespace-pre w-full">
                                        {errorInfo.componentStack}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </EmptyContent>
                </Empty>
            </div>
        </div>
    );
}
