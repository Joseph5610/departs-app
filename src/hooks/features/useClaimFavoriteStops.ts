import { useEffect } from 'react';
import { useStops } from '@/hooks/data/useStops';
import { usePreferencesStore } from '@/state/preferencesStore';
import { unclaimedFavoriteStops } from '@/domain/stops';

/**
 * Gives the selected city the pins saved before pins carried their city, once its stop list shows they are
 * its stops. Mount exactly once (MapController).
 */
export const useClaimFavoriteStops = () => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const favoriteStops = usePreferencesStore(s => s.favoriteStops);
    const claimFavoriteStops = usePreferencesStore(s => s.actions.claimFavoriteStops);
    const { model } = useStops();

    useEffect(() => {
        const unclaimed = unclaimedFavoriteStops(favoriteStops, model);
        if (unclaimed.length > 0) claimFavoriteStops(selectedCity, unclaimed);
    }, [favoriteStops, model, selectedCity, claimFavoriteStops]);
};
