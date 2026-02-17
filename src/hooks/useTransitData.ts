
import { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { API_ENDPOINTS, REFRESH_INTERVALS } from '../config/api';
import { EMPTY_GEOJSON } from '../config/constants';
import type {
    TrackedVehicle,
    VehicleCollection,
    VehicleFeature,
    StopCollection,
    VehicleDetail
} from '../types/transit';

/**
 * Hook to aggregate all transit-related data queries and compute derived views.
 * Consolidates multiple small hooks into a single data orchestration layer.
 */
export const useTransitData = (
    bounds: string | null,
    selectedVehicle: TrackedVehicle | null,
    selectedStopId: string | null,
    departureSort: 'line' | 'departure',
    routeFilter: string[] | null
) => {
    // 1. Derived IDs
    const trackedId = useMemo(() => {
        if (!selectedVehicle) return null;
        return selectedVehicle.gtfs_trip_id || selectedVehicle.trip_id || null;
    }, [selectedVehicle]);

    const selectedId = useMemo(() =>
        selectedVehicle?.vehicle_id || selectedVehicle?.id || null,
    [selectedVehicle]);

    // 2. Data Queries

    // Vehicles Query
    const { data: rawVehicles, isFetching: fetchingVehicles, dataUpdatedAt } = useQuery<VehicleFeature[]>({
        queryKey: ['vehicles', bounds, trackedId, routeFilter],
        queryFn: async () => {
            const url = new URL(API_ENDPOINTS.VEHICLES, window.location.origin);
            if (bounds) url.searchParams.set('bounds', bounds);
            if (trackedId) url.searchParams.set('tripId', trackedId);
            if (routeFilter && routeFilter.length > 0) {
                routeFilter.forEach(line => url.searchParams.append('routeShortName', line));
            }
            if (url.searchParams.toString() === '') return [];
            const response = await fetch(url.toString());
            return (await response.json()).features || [];
        },
        enabled: !!bounds || !!trackedId || (!!routeFilter && routeFilter.length > 0),
        refetchInterval: REFRESH_INTERVALS.VEHICLES,
        staleTime: 5000,
        placeholderData: keepPreviousData,
    });

    // Vehicle Detail Query
    const { data: vehicleDetail, isFetching: loadingDetail } = useQuery<VehicleDetail>({
        queryKey: ['vehicle-detail', selectedId, trackedId],
        queryFn: async () => {
            const url = new URL(API_ENDPOINTS.VEHICLE_DETAIL, window.location.origin);
            if (selectedId) url.searchParams.set('vehicleId', String(selectedId));
            if (trackedId) url.searchParams.set('tripId', String(trackedId));
            const response = await fetch(url.toString());
            return await response.json();
        },
        enabled: !!selectedId || !!trackedId,
        staleTime: 30000,
    });

    // Stops Query
    const { data: stops } = useQuery<StopCollection>({
        queryKey: ['stops'],
        queryFn: async () => {
            const response = await fetch(API_ENDPOINTS.STOPS);
            return await response.json();
        },
        staleTime: 24 * 60 * 60 * 1000, // 24h
    });

    // Departures Query
    const { data: departures, isLoading: loadingDeps } = useQuery({
        queryKey: ['departures', selectedStopId],
        queryFn: async () => {
            const response = await fetch(`${API_ENDPOINTS.DEPARTURES}?stopId=${selectedStopId}`);
            return await response.json();
        },
        enabled: !!selectedStopId,
        refetchInterval: REFRESH_INTERVALS.DEPARTURES,
    });

    // 3. Derived Map Data Views (GeoJSON)

    const displayVehicles = useMemo((): VehicleCollection => {
        return {
            type: 'FeatureCollection',
            features: rawVehicles || []
        };
    }, [rawVehicles]);

    const selectedVehicleFeature = useMemo((): VehicleCollection => {
        if (!selectedVehicle?._geometry) return EMPTY_GEOJSON as VehicleCollection;
        return {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                geometry: { type: 'Point', coordinates: selectedVehicle._geometry },
                properties: {
                    ...selectedVehicle,
                    gtfs_route_short_name: selectedVehicle.gtfs_route_short_name || selectedVehicle.route_short_name
                }
            } as VehicleFeature]
        };
    }, [selectedVehicle]);

    const stopsData = useMemo(() => {
        if (!stops?.features) return null;
        return {
            type: 'FeatureCollection',
            features: stops.features.filter(f => !f.properties.is_centroid)
        } as StopCollection;
    }, [stops]);

    const labelData = useMemo(() => {
        if (!stops?.features) return null;
        return {
            type: 'FeatureCollection',
            features: stops.features.filter(f => f.properties.is_centroid)
        } as StopCollection;
    }, [stops]);

    const routeShapeData = useMemo(() => {
        if (!selectedId || !vehicleDetail?.shapes || !Array.isArray(vehicleDetail.shapes)) return null;
        if (vehicleDetail.shapes.length < 2) return null;
        return {
            type: 'FeatureCollection' as const,
            features: [{
                type: 'Feature' as const,
                geometry: { type: 'LineString' as const, coordinates: vehicleDetail.shapes as [number, number][] },
                properties: {}
            }]
        };
    }, [selectedId, vehicleDetail]);

    // 4. Grouped Departures logic
    const groupedDepartures = useMemo(() => {
        if (!departures?.departures) return [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const groups: Record<string, any[]> = {};

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        departures.departures.forEach((dep: any) => {
            // Metro (type 1) is grouped by line AND direction
            const lineName = String(dep.line).toUpperCase();
            const isMetro = String(dep.type) === '1' || ['A', 'B', 'C'].includes(lineName);
            const key = isMetro ? `${lineName}-${dep.directionId}` : lineName;
            if (!groups[key]) groups[key] = [];
            groups[key].push(dep);
        });

        const result = Object.entries(groups).map(([key, deps]) => ({
            groupId: key,
            line: deps[0].line,
            type: deps[0].type,
            departures: deps,
            firstTime: new Date(deps[0].timestamp).getTime()
        }));

        if (departureSort === 'line') {
            result.sort((a, b) => {
                const typeA = Number(a.type) || 0;
                const typeB = Number(b.type) || 0;
                if (typeA !== typeB) return typeA - typeB;

                const lineA = String(a.line);
                const lineB = String(b.line);
                if (lineA !== lineB) return lineA.localeCompare(lineB, undefined, { numeric: true, sensitivity: 'base' });

                return a.firstTime - b.firstTime;
            });
        } else {
            result.sort((a, b) => a.firstTime - b.firstTime);
        }
        return result;
    }, [departures, departureSort]);

    return {
        fetchingVehicles,
        dataUpdatedAt,
        vehicleDetail,
        loadingDetail,
        stops,
        loadingDeps,
        groupedDepartures,
        routeShapeData,
        displayVehicles,
        selectedVehicleFeature,
        stopsData,
        labelData,
        selectedId
    };
};

export interface RSSItem {
    title: string;
    link: string;
    pubDate: string;
    content: string;
    contentSnippet: string;
    guid: string;
    isoDate: string;
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    priority?: string;
    lines?: string[];
    type?: 'incidents' | 'exclusions';
    isActive?: boolean;
    isFuture?: boolean;
}

/**
 * Hook for RSS feeds (incidents/exclusions).
 */
export const useRSS = (type: 'incidents' | 'exclusions') => {
    return useQuery({
        queryKey: ['rss', type],
        queryFn: async () => {
            const res = await fetch(`${API_ENDPOINTS.RSS}?type=${type}`);
            return await res.json();
        },
        refetchInterval: type === 'incidents' ? 5 * 60 * 1000 : 60 * 60 * 1000,
        staleTime: type === 'incidents' ? 5 * 60 * 1000 : 60 * 60 * 1000,
    });
};
