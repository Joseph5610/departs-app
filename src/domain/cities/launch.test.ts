import { describe, expect, it } from 'vitest';
import { launchCamera, launchFocus, type LaunchViewInput } from './index';

const HOUR = 3_600_000;
const NOW = Date.parse('2026-10-11T08:00:00Z');
const prague: LaunchViewInput['city'] = { center: [14.42, 50.09], bounds: [14.22, 49.94, 14.71, 50.18] };
const base: LaunchViewInput = {
    lastLocation: null, savedCamera: null, city: prague, now: NOW, maxAgeMs: 12 * HOUR,
    zoom: { location: 16, city: 12 },
};
const inPrague = { lat: 50.1, lng: 14.44 };
const inBrno = { lat: 49.19, lng: 16.61 };

// The map opens near the rider: their recent position, where they left it, else the city.
describe('launchCamera', () => {
    it('opens on a recent position in the city, then on the last view, then on the city overview', () => {
        const savedCamera = { value: { lat: 50.05, lng: 14.4, zoom: 14 }, at: NOW - HOUR };
        expect(launchCamera({ ...base, lastLocation: { value: inPrague, at: NOW - HOUR }, savedCamera }))
            .toEqual({ camera: { ...inPrague, zoom: 16 }, source: 'location' });
        expect(launchCamera({ ...base, savedCamera })).toEqual({ camera: savedCamera.value, source: 'saved' });
        expect(launchCamera(base)).toEqual({ camera: { lat: 50.09, lng: 14.42, zoom: 12 }, source: 'city' });
    });

    it('ignores saved positions that are stale or in another city', () => {
        expect(launchCamera({ ...base, lastLocation: { value: inPrague, at: NOW - 13 * HOUR } }).source).toBe('city');
        expect(launchCamera({ ...base, lastLocation: { value: inBrno, at: NOW } }).source).toBe('city');
        expect(launchCamera({ ...base, savedCamera: { value: { ...inBrno, zoom: 14 }, at: NOW } }).source).toBe('city');
    });
});

const focusBase = {
    cityAtLocation: 'brno', selectedCity: 'prague', accuracyM: 30, userMoved: false, hasOpenEntity: false, hasActiveRide: false,
    zoomSteps: [{ maxAccuracyM: 200, zoom: 15 }, { maxAccuracyM: 1500, zoom: 14 }, { maxAccuracyM: Infinity, zoom: 13 }],
};

// A fresh position at launch moves the map onto the rider, into the city they are in, unless they are busy.
describe('launchFocus', () => {
    it('switches to the city the rider is in, zoomed by accuracy', () => {
        expect(launchFocus(focusBase)).toEqual({ city: 'brno', zoom: 15, switchesCity: true });
        expect(launchFocus({ ...focusBase, selectedCity: 'brno', accuracyM: 800 })).toEqual({ city: 'brno', zoom: 14, switchesCity: false });
        expect(launchFocus({ ...focusBase, accuracyM: 5000 })?.zoom).toBe(13);
    });

    it('leaves the map alone outside every city, after the user moved it, with something open or on a ride', () => {
        expect(launchFocus({ ...focusBase, cityAtLocation: null })).toBeNull();
        expect(launchFocus({ ...focusBase, userMoved: true })).toBeNull();
        expect(launchFocus({ ...focusBase, hasOpenEntity: true })).toBeNull();
        expect(launchFocus({ ...focusBase, hasActiveRide: true })).toBeNull();
    });
});
