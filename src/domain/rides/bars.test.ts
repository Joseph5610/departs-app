import { describe, expect, it } from 'vitest';
import type { BoardingStatus, MyTrip, MyTripStatus, RidePhase, RideStatus } from '@/types';
import { rideBarState, tripBars } from './bars';

const trip = (tripId: string): MyTrip => ({
    city: 'prague', tripId, vehicleId: null, exitSequence: 5, startedAt: 0, toEnd: false, board: null,
});

const ride = (phase: RidePhase, extra: Partial<RideStatus> = {}): RideStatus => ({
    ride: trip('t'), phase, exitStopName: 'Stop 5', stopsLeft: 3, arrivalTime: '12:30', routeName: '22', routeColor: '', headsign: '',
    delay: 0, minutesToArrival: 10, progress: 0.5, ...extra,
});

const riding = (tripId: string, phase: RidePhase, minutesToArrival = 10): MyTripStatus =>
    ({ phase: 'riding', trip: trip(tripId), ride: ride(phase, { minutesToArrival }) });

const boarding = (tripId: string, minutes: number, isSoon = false): BoardingStatus => ({
    phase: 'boarding', trip: trip(tripId), stopName: 'Stop 2', departureTime: '12:10', minutes, isSoon,
    routeName: '22', routeColor: '', headsign: '', arrivalTime: null,
});

describe('rideBarState', () => {
    it('asks for attention at the stop before the exit and on arrival', () => {
        expect(rideBarState(ride('riding')).isAccent).toBe(false);
        expect(rideBarState(ride('next')).isAccent).toBe(true);
        expect(rideBarState(ride('arrived')).isAccent).toBe(true);
    });

    it('lists stops left and the arrival only while they mean something', () => {
        expect(rideBarState(ride('riding'))).toMatchObject({ showStopsLeft: true, showArrival: true, isLive: true });
        expect(rideBarState(ride('waiting'))).toMatchObject({ showStopsLeft: false, showArrival: true });
        expect(rideBarState(ride('riding', { stopsLeft: null }))).toMatchObject({ showStopsLeft: false });
        expect(rideBarState(ride('arrived'))).toMatchObject({ showArrival: false, isLive: false });
        expect(rideBarState(ride('unavailable'))).toMatchObject({ isLive: false });
    });

    // Under half a minute either way reads as on time.
    it('colours the arrival by a delay of at least half a minute', () => {
        expect([90, 20, -40, 0].map(delay => rideBarState(ride('riding', { delay })).delayTone)).toEqual(['late', null, 'early', null]);
        expect(rideBarState(ride('riding', { delay: null })).delayTone).toBeNull();
    });
});

describe('tripBars', () => {
    it('orders bars by urgency, a followed trip behind the user own at the same moment', () => {
        const bars = tripBars([boarding('a', 20), riding('b', 'next'), boarding('c', 3, true)], riding('f', 'next'));
        expect(bars.map(bar => bar.key)).toEqual(['b', 'c', 'followed', 'a']);
        expect(bars.find(bar => bar.key === 'followed')?.kind).toBe('followed');
    });

    it('leaves out trips without a state and rides still loading', () => {
        expect(tripBars([null, riding('a', 'loading'), boarding('b', 5)], riding('f', 'loading')).map(bar => bar.key)).toEqual(['b']);
    });
});
