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
import { LiveStatus } from './LiveStatus';
import { vehicleColorExpression, getVehicleColor } from '../utils/vehicleColors';
import { SettingsModal } from './SettingsModal';
import { WelcomeModal } from './WelcomeModal';
import { Settings } from 'lucide-react';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

// Styling layers for stops
const clusterLayer: any = { id: 'clusters', type: 'circle', source: 'pid-stops', filter: ['has', 'point_count'], paint: { 'circle-color': '#334155', 'circle-radius': ['step', ['get', 'point_count'], 15, 10, 20, 30, 25], 'circle-opacity': 0.8, 'circle-stroke-width': 1, 'circle-stroke-color': '#475569' } };
const clusterCountLayer: any = { id: 'cluster-count', type: 'symbol', source: 'pid-stops', filter: ['has', 'point_count'], layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 12 }, paint: { 'text-color': '#f8fafc' } };
const stopPointLayer: any = {
    id: 'unclustered-point',
    type: 'circle',
    source: 'pid-stops',
    filter: ['!', ['has', 'point_count']],
    paint: {
        'circle-radius': ['match', ['to-number', ['coalesce', ['get', 'location_type'], 0]],
            1, 10, // Station
            2, 7,  // Entrance
            6     // Regular stop
        ],
        'circle-color': ['match', ['to-number', ['coalesce', ['get', 'location_type'], 0]],
            1, '#38bdf8', // Station
            2, '#FFFFFF', // Entrance (crisp white)
            '#1e293b'    // Regular stop
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#38bdf8'
    }
};

const INITIAL = (() => {
    const p = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    return { lat: parseFloat(p.get('lat') || '50.0755'), lng: parseFloat(p.get('lng') || '14.4378'), z: parseFloat(p.get('z') || '13') };
})();

export const Map: React.FC = () => {
    const mapRef = useRef<any>(null);
    const [bounds, setBounds] = useState<string | null>(null);
    const [debouncedBounds, setDebouncedBounds] = useState<string | null>(null);
    const [selectedStop, setSelectedStop] = useState<{ id: string; name: string } | null>(null);
    const [showVehicles, setShowVehicles] = useState(true);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const debounceRef = useRef<any>(null);

    const { data: rawVehicles, isFetching: fetchingVehicles } = useVehicles(debouncedBounds);
    const { data: stops } = useStops();
    const { data: departures, isLoading: loadingDeps } = useDepartures(selectedStop?.id || null);

    const onMove = useCallback((evt: any) => {
        const { latitude, longitude, zoom } = evt.viewState;
        const b = evt.target.getBounds();
        const currentBounds = b && zoom >= 11 ? `${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}` : null;

        // Update URL
        const url = new URL(window.location.href);
        url.searchParams.set('lat', latitude.toFixed(5));
        url.searchParams.set('lng', longitude.toFixed(5));
        url.searchParams.set('z', zoom.toFixed(2));
        window.history.replaceState({}, '', url.toString());

        setBounds(currentBounds);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => setDebouncedBounds(currentBounds), 800);
    }, []);

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

    const [expandedLines, setExpandedLines] = useState<string[]>([]);

    const groupedDepartures = useMemo(() => {
        if (!departures?.departures) return [];
        const groups: Record<string, any[]> = {};

        // Group departures by line name
        departures.departures.forEach((dep: any) => {
            const key = dep.line;
            if (!groups[key]) groups[key] = [];
            groups[key].push(dep);
        });

        // Convert to array and preserve overall chronological order based on first departure
        return Object.entries(groups).map(([line, deps]) => ({
            line,
            type: deps[0].type,
            departures: deps // Keep all for toggle functionality
        })).sort((a, b) => {
            const timeA = new Date(a.departures[0].timestamp).getTime();
            const timeB = new Date(b.departures[0].timestamp).getTime();
            return timeA - timeB;
        });
    }, [departures]);

    const stopsData = useMemo(() => {
        if (!stops) return null;
        return { type: 'FeatureCollection' as const, features: (stops as any).features };
    }, [stops]);

    const toggleLine = (line: string) => {
        setExpandedLines(prev =>
            prev.includes(line) ? prev.filter(l => l !== line) : [...prev, line]
        );
    };

    return (
        <div className="w-full h-full bg-black relative">
            <LiveStatus fetching={fetchingVehicles} rawVehicles={rawVehicles} bounds={bounds} />

            <MapGL
                ref={mapRef}
                initialViewState={{ latitude: INITIAL.lat, longitude: INITIAL.lng, zoom: INITIAL.z }}
                onMove={onMove}
                onLoad={onLoad}
                style={{ width: '100%', height: '100%' }}
                mapStyle={MAP_STYLE}
                mapLib={maplibregl}
                onMouseEnter={(evt) => {
                    if (evt.features?.length) {
                        evt.target.getCanvas().style.cursor = 'pointer';
                    }
                }}
                onMouseLeave={(evt) => {
                    evt.target.getCanvas().style.cursor = '';
                }}
                onClick={(evt) => {
                    const f = evt.features?.[0];
                    if (!f) return;
                    if (f.layer.id === 'unclustered-point') {
                        const pc = f.properties.platform_code;
                        const name = (pc && pc.trim().length > 0) ? `${f.properties.stop_name} (${pc})` : f.properties.stop_name;
                        setSelectedStop({ id: f.properties.stop_id, name });
                        setExpandedLines([]); // Reset on new stop
                    }
                }}
                interactiveLayerIds={['unclustered-point', 'clusters']}
            >
                <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="p-3 bg-black/40 backdrop-blur-md hover:bg-black/60 text-white rounded-2xl border border-white/10 shadow-2xl transition-all pointer-events-auto group"
                        title="Settings"
                    >
                        <Settings size={20} className="group-hover:rotate-45 transition-transform" />
                    </button>
                    <NavigationControl position="top-right" showCompass={false} style={{ position: 'relative', top: 0, right: 0 }} />
                </div>

                {stopsData && (
                    <Source id="pid-stops" type="geojson" data={stopsData} cluster={true} clusterMaxZoom={13} clusterRadius={30}>
                        <Layer {...clusterLayer} />
                        <Layer {...clusterCountLayer} />
                        <Layer {...stopPointLayer} />
                    </Source>
                )}

                {showVehicles && rawVehicles && (
                    <Source id="pid-vehicles" type="geojson" data={rawVehicles}>
                        {/* 1. Base Circle */}
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
                        {/* 2. Direction Arrow Triangle ▲ */}
                        <Layer
                            id="vehicles-direction"
                            type="symbol"
                            minzoom={11}
                            layout={{
                                'text-field': '▲',
                                'text-font': ['Noto Sans Regular', 'Open Sans Bold'],
                                'text-size': ['interpolate', ['linear'], ['zoom'], 11, 8, 16, 14],
                                'text-rotate': ['get', 'bearing'],
                                'text-rotation-alignment': 'map',
                                'text-allow-overlap': true,
                                'text-ignore-placement': true,
                                'text-offset': [0, -1.7],
                                'text-anchor': 'center'
                            }}
                            paint={{
                                'text-color': vehicleColorExpression,
                                'text-halo-color': '#FFFFFF',
                                'text-halo-width': 1.5
                            }}
                        />
                        {/* 3. Line Label (White and Centered) */}
                        <Layer
                            id="vehicles-label"
                            type="symbol"
                            minzoom={10}
                            layout={{
                                'text-field': ['to-string', ['coalesce', ['get', 'gtfs_route_short_name'], ['get', 'route_short_name'], '']],
                                'text-font': ['Noto Sans Regular', 'Open Sans Bold'],
                                'text-size': ['interpolate', ['linear'], ['zoom'], 10, 9, 16, 13],
                                'text-allow-overlap': true,
                                'text-ignore-placement': true,
                                'text-anchor': 'center'
                            }}
                            paint={{
                                'text-color': '#FFFFFF',
                                'text-halo-color': '#000000',
                                'text-halo-width': 2
                            }}
                        />
                    </Source>
                )}
            </MapGL>

            <WelcomeModal />
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                showVehicles={showVehicles}
                setShowVehicles={setShowVehicles}
            />

            <BottomSheet isOpen={!!selectedStop} onClose={() => setSelectedStop(null)} title={selectedStop?.name}>
                <div className="space-y-6 pt-2">
                    {groupedDepartures.map((group) => {
                        const isExpanded = expandedLines.includes(group.line);
                        const visibleDepartures = isExpanded ? group.departures : [group.departures[0]];
                        const hasMore = group.departures.length > 1;

                        return (
                            <div key={group.line} className="space-y-3">
                                {/* Group Header */}
                                <div className="flex items-center gap-3 px-1">
                                    <div
                                        className="px-3 py-1 rounded-lg font-bold text-white text-xs shadow-md"
                                        style={{ backgroundColor: getVehicleColor(group.type, group.line) }}
                                    >
                                        {group.line}
                                    </div>
                                    <div className="h-[1px] flex-1 bg-white/10" />
                                </div>

                                {/* Departures for this line */}
                                <div className="space-y-2">
                                    {visibleDepartures.map((dep: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col">
                                                    <div className="text-white font-semibold leading-tight">{dep.headsign}</div>
                                                    <div className="text-slate-500 text-[10px] mt-1 flex items-center gap-2">
                                                        <span>{format(parseISO(dep.scheduled), 'HH:mm')}</span>
                                                        {dep.delay > 30 && <span className="text-rose-400">+{Math.round(dep.delay / 60)}m delay</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-lg font-mono font-bold text-emerald-400">
                                                    <Countdown timestamp={dep.timestamp} />
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Show More Button */}
                                    {hasMore && (
                                        <button
                                            onClick={() => toggleLine(group.line)}
                                            className="w-full py-2 text-slate-500 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:text-slate-400 transition-colors"
                                        >
                                            <div className="h-[1px] flex-1 bg-white/5" />
                                            <span>{isExpanded ? 'Show less' : `+ ${group.departures.length - 1} more connections`}</span>
                                            <div className="h-[1px] flex-1 bg-white/5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {groupedDepartures.length === 0 && !loadingDeps && (
                        <div className="py-12 text-center text-slate-500">No upcoming departures found.</div>
                    )}
                </div>
            </BottomSheet>
        </div>
    );
};
