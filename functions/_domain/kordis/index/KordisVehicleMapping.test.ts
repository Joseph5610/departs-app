import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as GtfsRt from '../../../_core/gtfsRtTypes';
import type { Schedule, ScheduleTrip } from '../../../_feeds/gtfs/schedule';
import { TripRuns } from '../../../_feeds/gtfs/TripRuns';
import { getLocalClock } from '../../../_core/utils/time';
import type { MappingSchedule } from '../../gtfs/index/VehicleIndex';
import { KordisVehicleMapping } from './KordisVehicleMapping';

/** 2026-11-07 09:30 in Brno. */
const NOW = Date.parse('2026-11-07T08:30:00Z');
const RUNNING: ScheduleTrip = [540, 600, -1, 0];
const EVENING: ScheduleTrip = [1200, 1260, -1, 0];

const entity = (label: string, tripId: string): GtfsRt.IFeedEntity => ({
    id: `${label}_${tripId}`,
    vehicle: { trip: { tripId }, vehicle: { label }, timestamp: NOW / 1000 },
});

const aliases = (table: Record<string, string>) => new TripRuns({ runs: [], other: table });

const mappingSchedule = (trips: Record<string, ScheduleTrip>, tripAliases: TripRuns[]): MappingSchedule => ({
    schedule: { days: ['20261107'], routes: ['L1'], trips } satisfies Schedule,
    tripAliases,
    clock: getLocalClock('Europe/Prague', NOW),
});

const assigned = (entities: GtfsRt.IFeedEntity[], schedule: MappingSchedule) =>
    Object.fromEntries(new KordisVehicleMapping().assignAll(entities, schedule).map(({ entity, tripId }) => [entity.vehicle!.vehicle!.label, tripId]));

describe('KordisVehicleMapping.assignAll', () => {
    beforeEach(() => vi.useFakeTimers({ now: NOW }));
    afterEach(() => vi.useRealTimers());

    it('maps a feed lagging two exports behind through the older export', () => {
        const schedule = mappingSchedule(
            { '301': EVENING, '302': EVENING, '101': RUNNING, '102': RUNNING },
            [aliases({ '1': '301', '2': '302' }), aliases({ '1': '101', '2': '102' })],
        );
        expect(assigned([entity('7001', '1'), entity('7002', '2')], schedule)).toEqual({ '7001': '101', '7002': '102' });
    });

    // A recycled id running under its own numbering too is read in the numbering the rest of the feed is on.
    it('reads an ambiguous id in the export the feed-wide majority is on', () => {
        const schedule = mappingSchedule(
            { '1': RUNNING, '101': RUNNING, '102': RUNNING, '103': RUNNING },
            [aliases({}), aliases({ '1': '101', '2': '102', '3': '103' })],
        );
        expect(assigned([entity('7001', '1'), entity('7002', '2'), entity('7003', '3')], schedule))
            .toEqual({ '7001': '101', '7002': '102', '7003': '103' });
    });

    it('keeps the feed\'s own ids when as many vehicles run under them as under an older export', () => {
        const schedule = mappingSchedule(
            { '1': RUNNING, '2': RUNNING, '101': RUNNING, '103': RUNNING },
            [aliases({ '1': '101', '3': '103' })],
        );
        expect(assigned([entity('7001', '1'), entity('7002', '2'), entity('7003', '3')], schedule))
            .toEqual({ '7001': '1', '7002': '2', '7003': '103' });
    });

    it('does not move a vehicle onto another numbering\'s trip when the feed\'s reading names one out of service', () => {
        const schedule = mappingSchedule(
            { '101': RUNNING, '102': RUNNING, '303': EVENING, '9': [600, 660, -1, 0] },
            [aliases({ '1': '101', '2': '102', '3': '303' }), aliases({ '3': '9' })],
        );
        expect(assigned([entity('7001', '1'), entity('7002', '2'), entity('7003', '3')], schedule))
            .toEqual({ '7001': '101', '7002': '102' });
    });
});
