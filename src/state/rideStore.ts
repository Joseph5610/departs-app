import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MyTrip, Ride } from '@/types';
import { followKey } from '@/domain/rides';
import { MY_TRIP_CONFIG } from '@/config/constants';


interface RideState {
    /** The user's trips (My trip), at most `MY_TRIP_CONFIG.MAX_TRIPS`, one per trip. */
    trips: MyTrip[];
    /** Someone else's trip, opened from a shared link: read-only, with their boarding stop and/or exit. */
    followed: MyTrip | null;
    /** The shared ride (`tripId:exitSequence`) the user stopped following, so its link doesn't follow it again. */
    unfollowedKey: string | null;
}

interface RideActions {
    /** Adds or replaces the user's trip on that trip; false when the limit is reached by other trips. */
    saveTrip: (trip: Omit<MyTrip, 'startedAt'>) => boolean;
    endTrip: (tripId: string) => void;
    /** Marks a trip's push registration as taken by the server; ignored once a newer save replaced it. */
    markTripPushed: (tripId: string, revision: number) => void;
    /** Marks that the app already alerted a trip's boarding itself. */
    markBoardAlerted: (tripId: string) => void;
    follow: (trip: Omit<MyTrip, 'startedAt'>) => void;
    /** Stops following; `remember` keeps the link from following the same ride again. */
    unfollow: (remember: boolean) => void;
}

export interface RideStore extends RideState {
    actions: RideActions;
}

const MAX_TRIPS = MY_TRIP_CONFIG.MAX_TRIPS;

/** The user's trips and one followed ride; persisted so a reload or a PWA relaunch keeps them. */
export const useRideStore = create<RideStore>()(
    persist(
        (set, get) => ({
            trips: [],
            followed: null,
            unfollowedKey: null,
            actions: {
                saveTrip: (trip) => {
                    const others = get().trips.filter(t => t.tripId !== trip.tripId);
                    if (others.length >= MAX_TRIPS) return false;
                    const existing = get().trips.find(t => t.tripId === trip.tripId);
                    set({ trips: [...others, { ...trip, startedAt: existing?.startedAt ?? Date.now() }] });
                    return true;
                },
                endTrip: (tripId) => set((state) => ({ trips: state.trips.filter(t => t.tripId !== tripId) })),
                markTripPushed: (tripId, revision) => set((state) => ({
                    trips: state.trips.map(t => (t.tripId === tripId && t.revision === revision ? { ...t, pushed: true } : t)),
                })),
                markBoardAlerted: (tripId) => set((state) => ({
                    trips: state.trips.map(t => (t.tripId === tripId && t.board ? { ...t, board: { ...t.board, alerted: true } } : t)),
                })),
                follow: (trip) => set({ followed: { ...trip, startedAt: Date.now() }, unfollowedKey: null }),
                unfollow: (remember) => set((state) => ({
                    followed: null,
                    unfollowedKey: remember && state.followed ? followKey(state.followed) : state.unfollowedKey,
                })),
            },
        }),
        {
            name: 'departs-ride',
            storage: createJSONStorage(() => localStorage),
            version: 4,
            migrate: (persisted, version) => {
                const old = persisted as { ride?: (Ride & { watching?: boolean }) | null; trips?: MyTrip[]; followed?: Ride | MyTrip | null; unfollowedKey?: string | null } | null;
                const asTrip = (ride: Ride): MyTrip => ({ board: null, toEnd: false, ...ride });
                if (version < 2 && old?.ride?.watching) {
                    const { watching: _watching, ...ride } = old.ride;
                    return { trips: [], followed: asTrip(ride), unfollowedKey: null };
                }
                const ride = old?.ride ?? null;
                return {
                    trips: old?.trips ?? (ride ? [asTrip(ride)] : []),
                    followed: old?.followed ? asTrip(old.followed) : null,
                    unfollowedKey: old?.unfollowedKey ?? null,
                };
            },
            partialize: (state) => ({ trips: state.trips, followed: state.followed, unfollowedKey: state.unfollowedKey }),
        }
    )
);
