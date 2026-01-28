import React, { useState, useCallback, useRef, useMemo } from 'react';
import MapGL, { Source, Layer, NavigationControl } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useVehicles } from '../hooks/useVehicles';
import { useStops } from '../hooks/useStops';
import { BottomSheet } from './BottomSheet';
import { useDepartures } from '../hooks/useDepartures';
import { format, parseISO } from 'date-fns';
import { Countdown } from './Countdown';
import { useAnimatedVehicles } from '../hooks/useAnimatedVehicles';
import { LiveStatus } from './LiveStatus';
import { vehicleColorExpression } from '../utils/vehicleColors';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const clusterLayer: any = { id: 'clusters', type: 'circle', source: 'pid-stops', filter: ['has', 'point_count'], paint: { 'circle-color': '#334155', 'circle-radius': ['step', ['get', 'point_count'], 15, 10, 20, 30, 25], 'circle-opacity': 0.8, 'circle-stroke-width': 1, 'circle-stroke-color': '#475569' } };
const clusterCountLayer: any = { id: 'cluster-count', type: 'symbol', source: 'pid-stops', filter: ['has', 'point_count'], layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 12 }, paint: { 'text-color': '#f8fafc' } };

// MAIN STOPS (Type 0 and 1)
const stopPointLayer: any = {
    id: 'unclustered-point', type: 'circle', source: 'pid-stops', filter: ['all', ['!', ['has', 'point_count']], ['!=', ['get', 'location_type'], 2]],
    paint: {
        'circle-radius': ['match', ['get', 'location_type'], 1, 8, 6],
        'circle-color': ['match', ['get', 'location_type'], 1, '#38bdf8', '#1e293b'],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#38bdf8'
    }
};
const stopLabelLayer: any = {
    id: 'unclustered-label', type: 'symbol', source: 'pid-stops', filter: ['all', ['!', ['has', 'point_count']], ['!=', ['get', 'location_type'], 2]], minzoom: 14.5,
    layout: {
        'text-field': ['case',
            ['any', ['!', ['has', 'platform_code']], ['==', ['get', 'platform_code'], ''], ['==', ['get', 'platform_code'], null]],
            ['get', 'stop_name'],
            ['concat', ['get', 'stop_name'], ' (', ['get', 'platform_code'], ')']
        ],
        'text-size': 10,
        'text-offset': [0, 1.2],
        'text-anchor': 'top',
        'text-font': ['Open Sans Regular']
    },
    paint: { 'text-color': '#e2e8f0', 'text-halo-color': '#0f172a', 'text-halo-width': 1 }
};

const entranceLabelLayer: any = {
    id: 'entrance-labels-native', type: 'symbol', source: 'pid-stops', filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'location_type'], 2]], minzoom: 16.5,
    layout: {
        'text-field': ['get', 'stop_name'],
        'text-size': 10,
        'text-offset': [0, 1.2],
        'text-anchor': 'top',
        'text-font': ['Open Sans Regular']
    },
    paint: {
        'text-color': '#94a3b8',
        'text-halo-color': '#0f172a',
        'text-halo-width': 1
    }
};

const INITIAL = (() => {
    const p = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    return { lat: parseFloat(p.get('lat') || '50.0755'), lng: parseFloat(p.get('lng') || '14.4378'), z: parseFloat(p.get('z') || '12'), stopId: p.get('stop') };
})();





export const Map: React.FC = () => {
    const mapRef = useRef<any>(null);
    const [bounds, setBounds] = useState<string | null>(null);
    const [debouncedBounds, setDebouncedBounds] = useState<string | null>(null);
    const [selectedStop, setSelectedStop] = useState<{ id: string; name: string } | null>(null);

    const debounceRef = useRef<any>(null);

    const { data: rawVehicles, isFetching: fetchingVehicles } = useVehicles(debouncedBounds);
    const { data: stops } = useStops();
    const { data: departures, isLoading: loadingDeps } = useDepartures(selectedStop?.id || null);

    const onMove = useCallback((evt: any) => {
        const { latitude, longitude, zoom } = evt.viewState;

        const url = new URL(window.location.href);
        url.searchParams.set('lat', latitude.toFixed(5));
        url.searchParams.set('lng', longitude.toFixed(5));
        url.searchParams.set('z', zoom.toFixed(2));
        if (selectedStop) url.searchParams.set('stop', selectedStop.id);
        window.history.replaceState({}, '', url.toString());

        const b = evt.target.getBounds();
        const currentBounds = b && zoom >= 11 ? `${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}` : null;

        setBounds(currentBounds);

        // Debounce network request
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setDebouncedBounds(currentBounds);
        }, 800);

    }, [selectedStop]);

    const onLoad = useCallback((evt: any) => {
        const map = evt.target;
        const b = map.getBounds();
        const z = map.getZoom();
        if (b && z >= 11) {
            const initialBounds = `${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}`;
            setBounds(initialBounds);
            setDebouncedBounds(initialBounds);
        }
    }, []);

    const stopsData = useMemo(() => {
        if (!stops) return null;
        return {
            type: 'FeatureCollection' as const,
            features: (stops as any).features?.filter((f: any) => f.properties.location_type !== 2)
        };
    }, [stops]);

    const entrancesData = useMemo(() => {
        if (!stops) return null;
        return {
            type: 'FeatureCollection' as const,
            features: (stops as any).features?.filter((f: any) => f.properties.location_type === 2)
        };
    }, [stops]);

    return (
        <div className="w-full h-full bg-slate-900 relative">
            <LiveStatus fetching={fetchingVehicles} rawVehicles={rawVehicles} bounds={bounds} />

            <MapGL
                ref={mapRef}
                initialViewState={{ latitude: INITIAL.lat, longitude: INITIAL.lng, zoom: INITIAL.z }}
                onMove={onMove}
                onLoad={onLoad}
                style={{ width: '100%', height: '100%' }}
                mapStyle={MAP_STYLE}
                mapLib={maplibregl}
                onClick={(evt) => {
                    const f = evt.features?.[0];
                    if (!f) return;
                    if (f.layer.id === 'unclustered-point') {
                        const pc = f.properties.platform_code;
                        const name = (pc && pc.trim().length > 0) ? `${f.properties.stop_name} (${pc})` : f.properties.stop_name;
                        setSelectedStop({ id: f.properties.stop_id, name });
                    }
                    if (f.layer.id === 'clusters' || f.layer.id === 'cluster-count') {
                        const m = evt.target;
                        const source = m.getSource('pid-stops') as any;
                        if (source && source.getClusterExpansionZoom) {
                            source.getClusterExpansionZoom(f.properties!.cluster_id, (err: any, z: number) => {
                                if (!err) m.easeTo({ center: (f.geometry as any).coordinates, zoom: z + 0.5, duration: 400 });
                            });
                        }
                    }
                }}
                interactiveLayerIds={['clusters', 'cluster-count', 'unclustered-point']}
                onMouseEnter={(e: any) => { if (e.target.getCanvas()) e.target.getCanvas().style.cursor = 'pointer'; }}
                onMouseLeave={(e: any) => { if (e.target.getCanvas()) e.target.getCanvas().style.cursor = ''; }}
            >
                <NavigationControl position="bottom-right" showCompass={false} />

                {stopsData && (
                    <Source id="pid-stops" type="geojson" data={stopsData} cluster={true} clusterMaxZoom={13} clusterRadius={30}>
                        <Layer {...clusterLayer} />
                        <Layer {...clusterCountLayer} />
                        <Layer {...stopPointLayer} />
                        <Layer {...stopLabelLayer} />
                    </Source>
                )}

                {entrancesData && (
                    <Source id="pid-entrances" type="geojson" data={entrancesData} cluster={false}>
                        <Layer {...entranceLabelLayer} source="pid-entrances" />
                    </Source>
                )}

                {rawVehicles && (
                    <Source id="pid-vehicles" type="geojson" data={rawVehicles}>
                        {/* 1. Vehicle Circle */}
                        <Layer
                            id="vehicles-point"
                            type="circle"
                            paint={{
                                'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 15, 14],
                                'circle-color': vehicleColorExpression,
                                'circle-stroke-width': 2,
                                'circle-stroke-color': '#FFFFFF'
                            }}
                        />
                        {/* 2. Direction Arrow - Using 'v' with anchor 'top' for max stability */}
                        <Layer
                            id="vehicles-direction"
                            type="symbol"
                            minzoom={10}
                            layout={{
                                'text-field': 'v',
                                'text-font': ['Open Sans Regular'],
                                'text-size': ['interpolate', ['linear'], ['zoom'], 10, 16, 16, 24],
                                'text-rotate': ['+', ['coalesce', ['get', 'bearing'], 0], 180],
                                'text-rotation-alignment': 'map',
                                'text-allow-overlap': true,
                                'text-ignore-placement': true,
                                'text-anchor': 'top' // Automatically offsets it out of center
                            }}
                            paint={{
                                'text-color': vehicleColorExpression,
                                'text-halo-color': '#FFFFFF',
                                'text-halo-width': 1.5
                            }}
                        />
                        {/* 3. Line Number (White and Centered) */}
                        <Layer
                            id="vehicles-label"
                            type="symbol"
                            minzoom={10}
                            layout={{
                                'text-field': ['to-string', ['coalesce', ['get', 'gtfs_route_short_name'], ['get', 'route_short_name'], '']],
                                'text-size': ['interpolate', ['linear'], ['zoom'], 10, 8, 16, 12],
                                'text-font': ['Open Sans Regular'],
                                'text-allow-overlap': true,
                                'text-ignore-placement': true,
                                'text-anchor': 'center'
                            }}
                            paint={{
                                'text-color': '#FFFFFF',
                                'text-halo-color': '#000000',
                                'text-halo-width': 1.5
                            }}
                        />
                    </Source>
                )}


            </MapGL>

            <BottomSheet isOpen={!!selectedStop} onClose={() => { setSelectedStop(null); const url = new URL(window.location.href); url.searchParams.delete('stop'); window.history.replaceState({}, '', url.toString()); }} title={selectedStop?.name}>
                <div className="space-y-4 pt-2">
                    {loadingDeps ? (
                        <div className="flex flex-col gap-3">
                            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-800/50 animate-pulse rounded-2xl" />)}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {departures?.departures?.length > 0 ? (
                                departures.departures.map((dep: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between p-4 bg-slate-800/40 rounded-2xl border border-slate-700/30">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 flex items-center justify-center bg-rose-600 rounded-xl font-bold text-white shadow-lg text-sm">{dep.line}</div>
                                            <div><div className="text-white font-semibold leading-tight">{dep.headsign}</div><div className="text-slate-500 text-[10px] mt-1">{format(parseISO(dep.scheduled), 'HH:mm')}</div></div>
                                        </div>
                                        <div className="text-right"><div className="text-lg font-mono font-bold"><Countdown timestamp={dep.timestamp} /></div>{dep.delay > 0 && <div className="text-rose-400 text-[10px] font-medium uppercase mt-1">+{Math.round(dep.delay / 60)}m delay</div>}</div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-12 text-center text-slate-500">No upcoming departures found.</div>
                            )}
                        </div>
                    )}
                </div>
            </BottomSheet>
        </div>
    );
};
