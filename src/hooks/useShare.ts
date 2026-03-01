import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from './useToast';

interface ShareOptions {
    title?: string;
    text?: string;
    url?: string;
}

export const useShare = () => {
    const { t } = useTranslation();
    const { showToast } = useToast();

    const share = useCallback(async (options: ShareOptions) => {
        const shareData = {
            title: options.title || 'departs.app',
            text: options.text,
            url: options.url || window.location.href,
        };

        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
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
                showToast(t('common.linkCopied'), 'success');
            } catch (err) {
                console.error('Error copying to clipboard:', err);
                showToast(t('common.copyError'), 'error');
            }
        }
    }, [showToast, t]);

    return { share };
};
