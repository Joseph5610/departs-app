import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { usePreferencesStore } from '../../state/preferencesStore';

interface ShareOptions {
    title?: string;
    text?: string;
    // Explicit entity IDs for clean URL construction
    stopId?: string;
    tripId?: string;
    vehicleId?: string;
}

export const useShare = () => {
    const { t } = useTranslation();
    const isSharing = useRef(false);

    const selectedCity = usePreferencesStore(s => s.selectedCity);

    const getConstructedUrl = useCallback((options: ShareOptions) => {
        // Build from scratch ONLY if we have entity IDs
        const base = `${window.location.origin}/${selectedCity}`;

        if (options.stopId) {
            return `${base}/stop/${encodeURIComponent(options.stopId)}`;
        }
        if (options.tripId) {
            if (options.vehicleId && options.vehicleId !== options.tripId) {
                return `${base}/trip/${encodeURIComponent(options.tripId)}/${encodeURIComponent(options.vehicleId)}`;
            }
            return `${base}/trip/${encodeURIComponent(options.tripId)}`;
        }

        // No valid entity IDs provided - strictly forbidden to fallback for privacy
        return null;
    }, [selectedCity]);

    const share = useCallback(async (options: ShareOptions) => {
        if (isSharing.current) return;
        
        const url = getConstructedUrl(options);
        
        if (!url) {
            console.error('Share attempted without entity IDs (stopId, tripId, or vehicleId). Fallback is disabled for privacy.');
            return;
        }

        const shareData = {
            title: options.title || 'departs.app',
            text: options.text,
            url: url,
        };

        const canShare = typeof navigator !== 'undefined' &&
                         !!navigator.share &&
                         (typeof navigator.canShare === 'undefined' || navigator.canShare(shareData));

        if (canShare) {
            isSharing.current = true;
            try {
                await navigator.share(shareData);
            } catch (err) {
                const errorName = (err as Error).name;
                if (errorName !== 'AbortError' && errorName !== 'InvalidStateError') {
                    console.error('Error sharing:', err);
                }
            } finally {
                // setTimeout to avoid edge cases where system UI closes but browser needs a tick
                setTimeout(() => {
                    isSharing.current = false;
                }, 100);
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
    }, [t, getConstructedUrl]);

    return { share };
};
