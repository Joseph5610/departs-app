import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Ride } from '@/types';
import { followKey } from '@/domain/rides';


interface RideState {
    ride: Ride | null;
    followed: Ride | null;
    /** The shared ride (`tripId:exitSequence`) the user stopped following, so its link doesn't follow it again. */
    unfollowedKey: string | null;
}

interface RideActions {
    startRide: (ride: Omit<Ride, 'startedAt'>) => void;
    endRide: () => void;
    follow: (ride: Omit<Ride, 'startedAt'>) => void;
    /** Stops following; `remember` keeps the link from following the same ride again. */
    unfollow: (remember: boolean) => void;
}

export interface RideStore extends RideState {
    actions: RideActions;
}


/** The user's ride and one followed ride; persisted so a reload or a PWA relaunch keeps them. */
export const useRideStore = create<RideStore>()(
    persist(
        (set) => ({
            ride: null,
            followed: null,
            unfollowedKey: null,
            actions: {
                startRide: (ride) => set({ ride: { ...ride, startedAt: Date.now() } }),
                endRide: () => set({ ride: null }),
                follow: (ride) => set({ followed: { ...ride, startedAt: Date.now() }, unfollowedKey: null }),
                unfollow: (remember) => set((state) => ({
                    followed: null,
                    unfollowedKey: remember && state.followed ? followKey(state.followed) : state.unfollowedKey,
                })),
            },
        }),
        {
            name: 'departs-ride',
            storage: createJSONStorage(() => localStorage),
            version: 2,
            migrate: (persisted) => {
                const old = (persisted as { ride?: (Ride & { watching?: boolean }) | null } | null)?.ride ?? null;
                if (!old) return { ride: null, followed: null, unfollowedKey: null };
                const { watching, ...ride } = old;
                return watching
                    ? { ride: null, followed: ride, unfollowedKey: null }
                    : { ride, followed: null, unfollowedKey: null };
            },
            partialize: (state) => ({ ride: state.ride, followed: state.followed, unfollowedKey: state.unfollowedKey }),
        }
    )
);
