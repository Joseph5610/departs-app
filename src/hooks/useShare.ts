import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

interface ShareOptions {
    title?: string;
    text?: string;
    url?: string;
}

export const useShare = () => {
    const { t } = useTranslation();

    const share = useCallback(async (options: ShareOptions) => {
        const shareData = {
            title: options.title || 'departs.app',
            text: options.text,
            url: options.url || window.location.href,
        };

        const canShare = typeof navigator !== 'undefined' &&
                         !!navigator.share &&
                         (typeof navigator.canShare === 'undefined' || navigator.canShare(shareData));

        if (canShare) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                if ((err as Error).name !== 'AbortError') {
                    console.error('Error sharing:', err);
                }
            }
        } else {
            // Fallback to clipboard
            try {
                await navigator.clipboard.writeText(shareData.url);
                toast.success(t('common.linkCopied'));
            } catch (err) {
                console.error('Error copying to clipboard:', err);
                toast.error(t('common.copyError'));
            }
        }
    }, [t]);

    return { share };
};
