import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, RefreshCw, WifiOff, CloudOff, MapPinOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppErrorCode, type AppError } from '@/types';
import { EmptyState } from '@/components/EmptyState';

interface ErrorStateProps {
    error: AppError | null;
    onRetry?: () => void;
    title?: string;
}

export const ErrorState = memo(({ error, onRetry, title }: ErrorStateProps) => {
    const { t } = useTranslation();

    const isNetworkError = error?.code === AppErrorCode.NETWORK_ERROR;
    const isTimeout = error?.code === AppErrorCode.TIMEOUT;
    const isUpstream = error?.isUpstream;
    const isNotFound = error?.status === 404;

    const Icon = isNotFound ? MapPinOff : (isNetworkError ? WifiOff : (isUpstream ? CloudOff : AlertCircle));

    let message = t('errors.generic');
    let defaultTitle = t('errors.generic');

    if (isNotFound) {
        message = t('errors.notFound');
        defaultTitle = t('errors.notFoundTitle');
    } else if (isNetworkError) {
        message = t('errors.network');
    } else if (isTimeout) {
        message = t('errors.timeout');
    } else if (isUpstream) {
        message = t('errors.upstream');
    } else if (error?.message) {
        message = error.message;
    }

    const displayTitle = title || (isNotFound ? defaultTitle : t('errors.generic'));

    return (
        <EmptyState icon={Icon} tone={isNotFound ? 'positive' : 'error'} title={displayTitle} description={message} className="py-16">
            {onRetry && !isNotFound && (
                <Button variant="secondary" size="sm" onClick={onRetry}>
                    <RefreshCw size={14} strokeWidth={1.5} />
                    {t('common.retry')}
                </Button>
            )}
        </EmptyState>
    );
});

ErrorState.displayName = 'ErrorState';
