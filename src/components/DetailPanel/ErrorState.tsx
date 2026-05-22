import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, RefreshCw, WifiOff, CloudOff } from 'lucide-react';
import { Box, Stack, Surface } from '../ui/layout';
import { Button } from '../ui/button';
import { AppErrorCode, type AppError } from '../../types/error';

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

    const Icon = isNetworkError ? WifiOff : (isUpstream ? CloudOff : AlertCircle);
    
    let message = t('errors.generic');
    if (isNetworkError) message = t('errors.network');
    else if (isTimeout) message = t('errors.timeout');
    else if (isUpstream) message = t('errors.upstream');
    else if (error?.message) message = error.message;

    return (
        <Stack className="py-20 px-8 items-center text-center animate-in fade-in zoom-in-95 duration-700">
            <Box className="relative mb-8">
                {/* Glow effect */}
                <Box className="absolute inset-0 bg-destructive/20 blur-2xl rounded-full scale-150 animate-pulse duration-3000" />
                
                <Surface 
                    variant="tinted" 
                    padding="md" 
                    className="relative rounded-2xl text-destructive/90 border-destructive/20 shadow-2xl backdrop-blur-md"
                >
                    <Icon size={32} strokeWidth={2} className="opacity-90" />
                </Surface>
            </Box>
            
            <Stack gap={2} className="mb-10">
                {title && (
                    <Box className="text-lg font-bold tracking-tight text-foreground/90">{title}</Box>
                )}
                <Box className="text-[13px] font-medium text-muted-foreground/60 max-w-[220px] leading-relaxed">
                    {message}
                </Box>
            </Stack>

            {onRetry && (
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={onRetry}
                    className="group gap-2.5 font-bold text-[11px] uppercase tracking-[0.2em] text-muted-foreground/60 hover:text-foreground transition-all rounded-full px-5"
                >
                    <RefreshCw size={14} className="opacity-50 group-hover:opacity-100 group-hover:rotate-180 transition-all duration-700 ease-in-out"  strokeWidth={1.5} />
                    {t('common.retry')}
                </Button>
            )}
        </Stack>
    );
});

ErrorState.displayName = 'ErrorState';
