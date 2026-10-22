import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { usePreferencesStore } from '@/state/preferencesStore';
import { paths } from '@/lib/routes';
import { SITE } from '@/config/site';

interface ShareOptions {
    title?: string;
    text?: string;
    stopId?: string;
    tripId?: string;
    vehicleId?: string;
    /** The entity's city; defaults to the selected one. */
    city?: string;
    /** Marks the sharer's exit stop on the shared trip. */
    exitSequence?: number;
    /** Marks the sharer's boarding stop on the shared trip. */
    boardSequence?: number;
}

export const useShare = () => {
    const { t } = useTranslation();
    const isSharing = useRef(false);

    const selectedCity = usePreferencesStore(s => s.selectedCity);

    const getConstructedUrl = useCallback((options: ShareOptions) => {
        const origin = window.location.origin;

        if (options.stopId) {
            return origin + paths.stop(options.city ?? selectedCity, options.stopId);
        }
        if (options.tripId) {
            const params = new URLSearchParams();
            if (options.boardSequence !== undefined) params.set('board', String(options.boardSequence));
            if (options.exitSequence !== undefined) params.set('exit', String(options.exitSequence));
            const query = params.toString() ? `?${params.toString()}` : '';
            return origin + paths.trip(options.city ?? selectedCity, options.tripId, options.vehicleId) + query;
        }

        // Never fall back to the current URL: its map parameters can carry the user's position.
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
            title: options.title || SITE.NAME,
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
                setTimeout(() => {
                    isSharing.current = false;
                }, 100);
            }
        } else {
            try {
                await navigator.clipboard.writeText(shareData.text ? `${shareData.text}\n${shareData.url}` : shareData.url);
                toast.success(t('common.linkCopied'));
            } catch (err) {
                console.error('Error copying to clipboard:', err);
                toast.error(t('common.copyError'));
            }
        }
    }, [t, getConstructedUrl]);

    return { share };
};

export interface TripShare {
    /** Defaults to the selected city. */
    city?: string;
    tripId: string;
    vehicleId?: string | null;
    line: string;
    headsign: string;
    delaySeconds?: number | null;
    /** The sharer's ride: their exit stop and expected arrival there. */
    ride?: { exitSequence: number; stopName: string; time: string | null };
    /** The sharer's boarding stop and expected departure there, before they board. */
    board?: { sequence: number; stopName: string; time: string | null };
}

/** Shares a trip with a live summary: the sharer's boarding and/or arrival on My trip, otherwise its line, direction and delay. */
export const useShareTrip = () => {
    const { t } = useTranslation();
    const { share } = useShare();

    return useCallback((trip: TripShare) => {
        const delayMins = trip.delaySeconds ? Math.round(trip.delaySeconds / 60) : 0;
        const base = { line: trip.line, headsign: trip.headsign };
        const text = trip.board
            ? t(trip.ride ? 'share.tripFull' : 'share.tripFrom', { ...base, from: trip.board.stopName, depart: trip.board.time ?? '', stop: trip.ride?.stopName, time: trip.ride?.time ?? '' })
            : trip.ride
            ? t(trip.ride.time ? 'share.ride' : 'share.rideNoTime', { ...base, stop: trip.ride.stopName, time: trip.ride.time })
            : t(delayMins > 0 ? 'share.tripDelayed' : 'share.trip', { ...base, count: delayMins });
        return share({
            title: t('map.vehicleDetails.shareTitle', { line: trip.line }),
            text,
            city: trip.city,
            tripId: trip.tripId,
            vehicleId: trip.vehicleId || undefined,
            exitSequence: trip.ride?.exitSequence,
            boardSequence: trip.board?.sequence,
        });
    }, [share, t]);
};
