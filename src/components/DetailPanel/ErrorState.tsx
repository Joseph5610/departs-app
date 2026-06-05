import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, RefreshCw, WifiOff, CloudOff, MapPinOff } from 'lucide-react';
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

    const displayTitle = title || (isNotFound ? defaultTitle : undefined);

    return (
        <Stack className="py-24 px-8 items-center text-center animate-in fade-in zoom-in-95 duration-700">
            <Box className="relative mb-10">
                {/* Glow effect */}
                <Box className={`absolute inset-0 ${isNotFound ? 'bg-primary/20' : 'bg-destructive/20'} blur-3xl rounded-full scale-150 animate-pulse duration-3000`} />
                
                <Surface 
                    variant="tinted" 
                    padding="md" 
                    className={`relative rounded-3xl ${isNotFound ? 'text-primary/90 border-primary/20' : 'text-destructive/90 border-destructive/20'} shadow-2xl backdrop-blur-md`}
                >
                    <Icon size={40} strokeWidth={1.5} className="opacity-90" />
                </Surface>
            </Box>
            
            <Stack gap={2} className="mb-10 items-center">
                {displayTitle && (
                    <Box className="text-xl font-bold tracking-tight text-foreground/90">{displayTitle}</Box>
                )}
                <Box className="text-[14px] font-medium text-muted-foreground/60 max-w-[240px] leading-relaxed">
                    {message}
                </Box>
            </Stack>

            {onRetry && !isNotFound && (
                <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={onRetry}
                    className="group gap-2.5 font-bold text-[12px] uppercase tracking-[0.15em] text-foreground/80 hover:text-foreground transition-all rounded-full px-6 py-5 shadow-lg bg-white/5 hover:bg-white/10"
                >
                    <RefreshCw size={16} className="opacity-70 group-hover:opacity-100 group-hover:rotate-180 transition-all duration-700 ease-in-out" strokeWidth={1.5} />
                    {t('common.retry')}
                </Button>
            )}
        </Stack>
    );
});

ErrorState.displayName = 'ErrorState';
