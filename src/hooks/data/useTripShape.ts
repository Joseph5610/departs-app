import '../../lib/zod-config';
import { z } from 'zod/mini';
import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import localforage from 'localforage';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useCityConfig } from './useCities';
import { apiFetch } from '../../lib/api-client';
import { EXTERNAL_URLS, QUERY_TIMING_MS, TRIP_SHAPES_CONFIG } from '../../config/constants';

type ShapeCoordinates = [number, number][];

const tripShapeIndexSchema = z.record(z.string(), z.string());
const shapeSegmentsSchema = z.array(z.array(z.tuple([z.number(), z.number()])));

/** The trip -> shape index per city, kept on the device (IndexedDB) so a reload does not download it again. */
const indexStore = localforage.createInstance({ name: 'departs', storeName: 'trip_shapes' });

interface CachedShapeIndex {
    index: Record<string, string>;
    updatedAt: number;
}

/** A device copy younger than `TRIP_SHAPES_STALE`, else a fresh download saved over it. Storage failures never fail the query. */
async function loadShapeIndex(city: string, url: string): Promise<Record<string, string>> {
    try {
        const cached = await indexStore.getItem<CachedShapeIndex>(city);
        if (cached && Date.now() - cached.updatedAt < QUERY_TIMING_MS.TRIP_SHAPES_STALE) {
            const parsed = tripShapeIndexSchema.safeParse(cached.index);
            if (parsed.success) return parsed.data;
        }
    } catch (error) {
        console.warn('Trip shape index device cache unavailable, downloading instead', error);
    }

    const index = tripShapeIndexSchema.parse(await apiFetch<unknown>(url));
    try {
        await indexStore.setItem<CachedShapeIndex>(city, { index, updatedAt: Date.now() });
    } catch (error) {
        console.warn('Could not save the trip shape index to the device cache', error);
    }
    return index;
}

/** The `shape_chunks/` bucket a shape lives in. */
function shapeChunkId(shapeId: string): string {
    const numeric = parseInt(shapeId, 10);
    return String((Number.isNaN(numeric) ? 0 : Math.abs(numeric)) % TRIP_SHAPES_CONFIG.CHUNK_COUNT);
}

/**
 * The precise route geometry of a trip, read straight from the static data CDN for cities with
 * `hasTripShapes`: the trip's shape_id from `trip_shapes.json` (kept on the device), then its segments
 * out of that shape's chunk (kept in memory only), flattened into one line. Null while loading, for
 * other cities, or when the trip has no shape.
 */
export function useTripShape(tripId: string | null | undefined): ShapeCoordinates | null {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const hasTripShapes = Boolean(useCityConfig().hasTripShapes);
    const baseUrl = `${EXTERNAL_URLS.STATIC_DATA}/${selectedCity}`;

    const { data: index } = useQuery({
        queryKey: ['trip-shape-index', selectedCity],
        queryFn: () => loadShapeIndex(selectedCity, `${baseUrl}/trip_shapes.json`),
        enabled: hasTripShapes && !!tripId,
        staleTime: QUERY_TIMING_MS.TRIP_SHAPES_STALE,
        gcTime: QUERY_TIMING_MS.TRIP_SHAPES_STALE,
    });

    const shapeId = tripId ? index?.[tripId] : undefined;
    const chunkId = shapeId ? shapeChunkId(shapeId) : undefined;

    const selectShape = useCallback((chunk: Record<string, unknown>): ShapeCoordinates | null => {
        const segments = shapeId ? shapeSegmentsSchema.safeParse(chunk[shapeId]) : null;
        if (!segments?.success) return null;
        const coordinates = segments.data.flat();
        return coordinates.length > 1 ? coordinates : null;
    }, [shapeId]);

    const { data: shape } = useQuery({
        queryKey: ['trip-shape-chunk', selectedCity, chunkId],
        queryFn: () => apiFetch<Record<string, unknown>>(`${baseUrl}/shape_chunks/${encodeURIComponent(chunkId!)}.json`),
        enabled: hasTripShapes && !!chunkId,
        select: selectShape,
        staleTime: QUERY_TIMING_MS.TRIP_SHAPES_STALE,
        gcTime: QUERY_TIMING_MS.TRIP_SHAPES_GC,
    });

    return hasTripShapes ? shape ?? null : null;
}
