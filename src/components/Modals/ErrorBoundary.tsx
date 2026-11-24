import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCcw, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/lib/apiClient';
import { PrivacyNote } from './FeedbackModal/PrivacyNote';
import { getDiagnosticSnapshot } from '@/hooks/features/useDiagnosticData';
import { Button } from '@/components/ui/button';
import { TURNSTILE_SITE_KEY } from '@/config/constants';

import { EmptyState } from '@/components/EmptyState';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { CodeBlock } from '@/components/CodeBlock';

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
    const { t } = useTranslation();
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
            setSubmitError(t('errors.crash.sendFailed'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
            <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center">
                <EmptyState icon={AlertCircle} tone="error" title={t('errors.crash.title')} description={t('errors.crash.description')} className="px-4 py-8">
                    <div className="flex w-full flex-col gap-3 pt-4">
                        <Button
                            variant="default"
                            onClick={() => window.location.reload()}
                            className="w-full gap-2"
                        >
                            <RefreshCcw size={18} strokeWidth={2} />
                            {t('errors.crash.refresh')}
                        </Button>

                        {TURNSTILE_SITE_KEY && (
                            <>
                            {!isSubmitted ? (
                                <div className="flex flex-col gap-2 w-full">
                                    <Button
                                        variant="secondary"
                                        onClick={handleReportCrash}
                                        disabled={!turnstileToken || isSubmitting}
                                        className="w-full gap-2"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="animate-spin" size={18} strokeWidth={2} />
                                                {t('errors.crash.sending')}
                                            </>
                                        ) : (
                                            <>
                                                <Send size={18} strokeWidth={2} />
                                                {t('errors.crash.send')}
                                            </>
                                        )}
                                    </Button>
                                    {submitError && (
                                        <Alert variant="destructive" align="center"><AlertTitle className="text-current">{submitError}</AlertTitle></Alert>
                                    )}
                                </div>
                            ) : (
                                <Alert variant="info" align="center">
                                    <CheckCircle2 />
                                    <AlertTitle>{t('errors.crash.sent')}</AlertTitle>
                                </Alert>
                            )}

                            <div className="flex justify-center w-full mt-2">
                                <Turnstile
                                    siteKey={TURNSTILE_SITE_KEY}
                                    onSuccess={setTurnstileToken}
                                    onError={() => setTurnstileToken(null)}
                                    onExpire={() => setTurnstileToken(null)}
                                />
                            </div>
                            <PrivacyNote />
                            </>
                        )}

                        <CodeBlock className="mt-3 max-h-60 w-full text-left">
                            <span className="text-destructive">{error?.toString()}</span>
                            {errorInfo?.componentStack}
                        </CodeBlock>
                    </div>
                </EmptyState>
            </div>
        </div>
    );
}
