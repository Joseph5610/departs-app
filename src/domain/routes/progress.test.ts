import { describe, expect, it } from 'vitest';
import { locateStops, measureLine, resolveProgress, splitLineAt } from './progress';

type LngLat = [number, number];

// ~111 m per 0.001° of latitude; a north-south line keeps the expected distances easy to read.
const LNG = 14.42;
const north = (metres: number): LngLat => [LNG, 50 + metres / 111_195];

// A trip that goes 1 km north and comes back, like a loop line returning past its first stops.
const outAndBack = measureLine([north(0), north(500), north(1000), north(500), north(0)]);

describe('locateStops', () => {
    // The return stop lies on top of the outbound one; it must still land after the turnaround.
    it('keeps a repeated stop in timetable order on a loop', () => {
        const along = locateStops(outAndBack, [north(0), north(500), north(1000), north(500), north(0)]);

        expect(along.map(Math.round)).toEqual([0, 500, 1000, 1500, 2000]);
    });

    it('places a stop without a position at the stop before it', () => {
        const line = measureLine([north(0), north(1000)]);

        expect(locateStops(line, [north(200), null, north(800)]).map(Math.round)).toEqual([200, 200, 800]);
    });
});

describe('resolveProgress', () => {
    const stops = locateStops(outAndBack, [north(0), north(500), north(1000), north(500), north(0)]);

    // Without the stop hint the position at 400 m is ambiguous (outbound or return); the reported stop decides.
    it('searches around the reported stop, so the return leg is not mistaken for the outbound one', () => {
        const outbound = resolveProgress(outAndBack, stops, { stopIndex: 1, position: north(400) });
        const inbound = resolveProgress(outAndBack, stops, { stopIndex: 3, position: north(400) });

        expect(Math.round(outbound!)).toBe(400);
        expect(Math.round(inbound!)).toBe(1600);
    });

    it('treats a vehicle far from its shape as off route', () => {
        const offRoute: LngLat = [LNG + 0.05, north(500)[1]];

        expect(resolveProgress(outAndBack, stops, { stopIndex: null, position: offRoute })).toBeNull();
    });

    // A network's own shape distance (any unit) beats the position estimate and is interpolated between shape points.
    it('converts a published shape distance to metres along the line', () => {
        const line = measureLine([north(0), north(1000), north(2000)]);
        const progress = resolveProgress(line, [], { shapeDistances: [0, 1, 2], reportedDistance: 1.25, stopIndex: null, position: null });

        expect(Math.round(progress!)).toBe(1250);
    });
});

describe('splitLineAt', () => {
    it('cuts the line so travelled and upcoming parts meet at the vehicle', () => {
        const line = measureLine([north(0), north(1000)]);
        const { traversed, upcoming } = splitLineAt(line, 250);

        expect(traversed.at(-1)).toEqual(upcoming[0]);
        expect(traversed.at(-1)![1]).toBeCloseTo(north(250)[1], 6);
    });
});
