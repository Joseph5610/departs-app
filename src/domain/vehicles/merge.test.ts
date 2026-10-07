import { describe, expect, it } from 'vitest';
import type { VehicleDetail, VehicleFeature, VehicleMetadata, StopTimeFeature } from '@/types';
import { MIN, NOW, indexBy, patch, vehicle, vehicleDetail } from '@/test/factories';
import type { PatchIndex } from '@/domain/realtime/patches';
import { mergeSelectedVehicle } from './merge';

interface Inputs {
    tripId?: string | null;
    vehicleId?: string | null;
    vehicles?: VehicleFeature[];
    detail?: VehicleDetail;
    byTripId?: PatchIndex;
    metadata?: VehicleMetadata;
}

const merge = ({ tripId = 'trip-1', vehicleId = null, vehicles = [], detail, byTripId = new Map(), metadata }: Inputs) =>
    mergeSelectedVehicle(
        tripId,
        vehicleId,
        indexBy(vehicles, (v) => v.properties.vehicle_id),
        indexBy(vehicles, (v) => v.properties.gtfs_trip_id),
        detail,
        byTripId,
        new Map(),
        new Map(),
        new Map(),
        metadata,
        NOW,
        NOW - MIN,
    );

const stopTime = (connections: NonNullable<StopTimeFeature['properties']['connections']>): StopTimeFeature => ({
    type: 'Feature',
    properties: { stop_name: 'Anděl', stop_sequence: 5, stop_id: 'U1040Z1P', arrival_time: '12:10:00', departure_time: '12:10:00', connections },
});

// The vehicle panel's single object, merged per AGENTS.md "Vehicle Data Priority": detail API > live stream > route IDs.
describe('mergeSelectedVehicle', () => {
    it('returns nothing without a trip in the route', () => {
        expect(merge({ tripId: null, vehicles: [vehicle('trip-1')] })).toBeNull();
    });

    it('prefers the detail API over the live stream for trip metadata and delay', () => {
        const result = merge({
            vehicles: [vehicle('trip-1', { delay: 30, route_color: '000000', trip_headsign: 'stale' })],
            detail: vehicleDetail({ delay: 90, route_color: '7A0603', trip_headsign: 'Bílá Hora' }),
        });

        expect(result).toMatchObject({ delay: 90, route_color: '7A0603', trip_headsign: 'Bílá Hora', vehicle_id: 'veh-trip-1' });
    });

    // A static-fallback detail is only the timetable, so the live stream stays the authority on where and how late.
    it('keeps live position, delay and progress when the detail is a static fallback', () => {
        const live = vehicle('trip-1', { delay: 240, bearing: 90, state_position: 'at_stop', last_stop_sequence: 7 }, [14.40, 50.07]);
        const result = merge({
            vehicles: [live],
            detail: vehicleDetail({ is_static_fallback: true, delay: 0, bearing: 0, state_position: 'on_track', last_stop_sequence: 1 }),
        });

        expect(result).toMatchObject({ delay: 240, bearing: 90, state_position: 'at_stop', last_stop_sequence: 7 });
        expect(result?.geometry?.coordinates).toEqual([14.40, 50.07]);
    });

    // A vehicle id in the URL can outlive its trip; its next trip's live data must not leak into the old one.
    it('ignores the live vehicle once it has moved on to another trip', () => {
        const result = merge({
            vehicleId: 'veh-1',
            vehicles: [vehicle('trip-2', { vehicle_id: 'veh-1', delay: 300 })],
            detail: vehicleDetail({ delay: null }),
        });

        expect(result).toMatchObject({ gtfs_trip_id: 'trip-1', vehicle_id: 'veh-1', delay: null });
    });

    it('falls back to the live position when the detail has a null-island point', () => {
        const result = merge({
            vehicles: [vehicle('trip-1', {}, [14.45, 50.1])],
            detail: vehicleDetail({ geometry: { type: 'Point', coordinates: [0, 0] } }),
        });

        expect(result?.geometry?.coordinates).toEqual([14.45, 50.1]);
    });

    it('fills operator and accessibility from the fleet register, keeping known descriptor values', () => {
        const result = merge({
            detail: vehicleDetail({ vehicle_descriptor: { vehicle_type: 'Škoda 15T', is_wheelchair_accessible: true } }),
            metadata: { operator: 'DPP', is_air_conditioned: true },
        });

        expect(result?.vehicle_descriptor).toEqual({ operator: 'DPP', vehicle_type: 'Škoda 15T', is_air_conditioned: true, is_wheelchair_accessible: true });
    });

    // Patches are compared against the newer of the two fetches, so a fresh WS delay beats both sources.
    it('applies a fresh push patch over the merged result', () => {
        const result = merge({
            vehicles: [vehicle('trip-1', { delay: 30 })],
            detail: vehicleDetail({ delay: 60 }),
            byTripId: new Map([['trip-1', patch({ tripId: 'trip-1', delay: 180 })]]),
        });

        expect(result).toMatchObject({ delay: 180, is_enriched: true });
    });

    // The backend sends connections as scheduled rows; the onward trip's live vehicle and delay come from the fleet.
    it('fills each stop connection with its live vehicle and delay', () => {
        const connection = { trip_id: 'trip-9', line: '9', type: 'tram' as const, headsign: 'Sídliště Řepy', departure_time: '12:12:00', delay: null, max_wait_s: 120, at_risk: false };
        const result = merge({
            vehicles: [vehicle('trip-9', { delay: 120 })],
            detail: vehicleDetail({ stop_times: { type: 'FeatureCollection', features: [stopTime([connection])] } }),
        });

        expect(result?.stop_times?.features[0].properties.connections?.[0]).toMatchObject({ vehicle_id: 'veh-trip-9', delay: 120 });
    });
});
