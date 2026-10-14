import { describe, expect, it } from 'vitest';
import { NOW, patch, stopTime, vehicleDetail } from '@/test/factories';
import { applyEnrichment } from './patches';

describe('applyEnrichment', () => {
    // An estimate is not a message from the network's stream, so the detail must not present it as live.
    it('marks an estimated delay as an estimate, not as live enrichment', () => {
        const detail = vehicleDetail({ delay: null });
        const byTripId = new Map([[detail.gtfs_trip_id, patch({ tripId: detail.gtfs_trip_id, delay: 60, isEstimate: true })]]);

        const result = applyEnrichment(detail, detail.gtfs_trip_id, null, byTripId, new Map(), NOW);

        expect(result).toMatchObject({ delay: 60, is_delay_estimated: true });
        expect(result.is_enriched).toBeUndefined();
        expect(result).not.toHaveProperty('isEstimate');
    });

    // A patched delay must move the detail's upcoming stop times with it, as the backend derives them.
    it('shifts the realtime times of the stops from the vehicle\'s last one on', () => {
        const detail = vehicleDetail({
            delay: 0,
            last_stop_sequence: 2,
            stop_times: { type: 'FeatureCollection', features: [stopTime(1, '12:00:00'), stopTime(2, '12:05:00'), stopTime(3, '12:10:00')] },
        });
        const byTripId = new Map([[detail.gtfs_trip_id, patch({ tripId: detail.gtfs_trip_id, delay: 120 })]]);

        const result = applyEnrichment(detail, detail.gtfs_trip_id, null, byTripId, new Map(), NOW);

        expect(result.stop_times?.features.map(f => f.properties.realtime_arrival_time)).toEqual([undefined, '12:07:00', '12:12:00']);
    });

    // Which stops were served is unknown without the vehicle's live stop, so their times must stay as fetched.
    it('leaves the stop times alone without a live stop sequence', () => {
        const stop_times = { type: 'FeatureCollection' as const, features: [stopTime(1, '12:00:00'), stopTime(2, '12:05:00')] };
        const byTripId = (tripId: string) => new Map([[tripId, patch({ tripId, delay: 120 })]]);
        const unplaced = vehicleDetail({ delay: 0, last_stop_sequence: null, stop_times });
        const fallback = vehicleDetail({ delay: 0, last_stop_sequence: 1, is_static_fallback: true, stop_times });

        expect(applyEnrichment(unplaced, unplaced.gtfs_trip_id, null, byTripId(unplaced.gtfs_trip_id), new Map(), NOW).stop_times).toBe(stop_times);
        expect(applyEnrichment(fallback, fallback.gtfs_trip_id, null, byTripId(fallback.gtfs_trip_id), new Map(), NOW).stop_times).toBe(stop_times);
    });
});
