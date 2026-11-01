import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, RefreshCw, WifiOff, CloudOff, MapPinOff } from 'lucide-react';
import {
    Empty,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
    EmptyDescription,
    EmptyContent,
} from '@/components/ui/empty';
import { Button } from '@/components/ui/button';
import { AppErrorCode, type AppError } from '@/types';

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
        <Empty className="py-16 animate-in fade-in zoom-in-95 duration-500">
            <EmptyHeader>
                <EmptyMedia
                    variant="tile" className={isNotFound ? "bg-selected text-tint-mint" : "bg-tint-red/16 text-destructive"}
                >
                    <Icon strokeWidth={1.5} />
                </EmptyMedia>
                <EmptyTitle className="type-headsign text-foreground/90">
                    {displayTitle}
                </EmptyTitle>
                <EmptyDescription className="type-meta max-w-55">
                    {message}
                </EmptyDescription>
            </EmptyHeader>

            {onRetry && !isNotFound && (
                <EmptyContent>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onRetry}
                        className="gap-2 type-group rounded-full px-5 py-4"
                    >
                        <RefreshCw size={14} strokeWidth={1.5} />
                        {t('common.retry')}
                    </Button>
                </EmptyContent>
            )}
        </Empty>
    );
});

ErrorState.displayName = 'ErrorState';
