import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
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
import { Settings, LocateFixed } from 'lucide-react';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

// Layer Definitions
const clusterLayer: any = {
    id: 'clusters',
    type: 'circle',
    source: 'pid-stops',
    filter: ['has', 'point_count'],
    paint: {
        'circle-color': '#334155',
        'circle-radius': ['step', ['get', 'point_count'], 15, 10, 20, 30, 25],
        'circle-opacity': 0.8,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#475569'
    }
};

const clusterCountLayer: any = {
    id: 'cluster-count',
    type: 'symbol',
    source: 'pid-stops',
    filter: ['has', 'point_count'],
    layout: {
        'text-field': '{point_count_abbreviated}',
        'text-size': 12
    },
    paint: {
        'text-color': '#f8fafc'
    }
};

const stopPointLayer: any = {
    id: 'unclustered-point',
    type: 'circle',
    source: 'pid-stops',
    filter: ['all',
        ['!', ['has', 'point_count']],
        ['!=', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 2],
        // Only exclude Stations (Type 1) with transfer names, keeping Stops (Type 0) visible
        ['!', ['all',
            ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1],
            ['match', ['get', 'stop_name'], ['Můstek', 'Muzeum', 'Florenc'], true, false]
        ]]
    ],
    paint: {
        'circle-radius': ['match', ['to-number', ['coalesce', ['get', 'location_type'], 0]],
            1, 10, // Station
            6     // Stop
        ],
        'circle-color': ['case',
            // Only apply custom colors for Stations (Type 1)
            ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1],
            ['match', ['get', 'stop_name'],
                // Transfers -> WHITE
                'Můstek', '#FFFFFF',
                'Muzeum', '#FFFFFF',
                'Florenc', '#FFFFFF',

                // Single Lines (Check if 'metro_lines' contains specific line)
                // Since Mapbox expressions with arrays are tricky, we rely on the backend strictly sending correct single letters for non-transfers.
                // Or simplified: we know the station names (except new ones).
                // Actually, 'match' on specific arrays is hard.
                // Let's use the 'in' check on the array if possible, or fallback to name-based logic since we have the list.
                // BUT WAIT: maplibre 'match' works on scalar values mainly. 
                // Let's use a simpler approach: check membership in the array string representation or just use 'case' logic.
                // The most robust way without complex expressions:
                // We will rely on the fact that for single line stations, we can just check the first element.
                // But wait, it's easier to just match the lines we know.

                // LINE A
                'Nemocnice Motol', '#00A562', 'Petřiny', '#00A562', 'Nádraží Veleslavín', '#00A562', 'Bořislavka', '#00A562',
                'Dejvická', '#00A562', 'Hradčanská', '#00A562', 'Malostranská', '#00A562', 'Staroměstská', '#00A562',
                'Náměstí Míru', '#00A562', 'Jiřího z Poděbrad', '#00A562', 'Flora', '#00A562', 'Želivského', '#00A562',
                'Strašnická', '#00A562', 'Skalka', '#00A562', 'Depo Hostivař', '#00A562',

                // LINE B
                'Zličín', '#DEBD29', 'Stodůlky', '#DEBD29', 'Luka', '#DEBD29', 'Lužiny', '#DEBD29', 'Hůrka', '#DEBD29',
                'Nové Butovice', '#DEBD29', 'Jinonice', '#DEBD29', 'Radlická', '#DEBD29', 'Smíchovské nádraží', '#DEBD29',
                'Anděl', '#DEBD29', 'Karlovo náměstí', '#DEBD29', 'Národní třída', '#DEBD29', 'Náměstí Republiky', '#DEBD29',
                'Křižíkova', '#DEBD29', 'Invalidovna', '#DEBD29', 'Palmovka', '#DEBD29', 'Českomoravská', '#DEBD29',
                'Vysočanská', '#DEBD29', 'Kolbenova', '#DEBD29', 'Hloubětín', '#DEBD29', 'Rajská zahrada', '#DEBD29', 'Černý Most', '#DEBD29',

                // LINE C
                'Letňany', '#C6242D', 'Prosek', '#C6242D', 'Střížkov', '#C6242D', 'Ládví', '#C6242D', 'Kobylisy', '#C6242D',
                'Nádraží Holešovice', '#C6242D', 'Vltavská', '#C6242D', 'Hlavní nádraží', '#C6242D', 'I. P. Pavlova', '#C6242D',
                'Vyšehrad', '#C6242D', 'Pražského povstání', '#C6242D', 'Pankrác', '#C6242D', 'Budějovická', '#C6242D',
                'Kačerov', '#C6242D', 'Roztyly', '#C6242D', 'Chodov', '#C6242D', 'Opatov', '#C6242D', 'Háje', '#C6242D',

                '#38bdf8' // Default (Blue) for unknown stations
            ],

            // Default for Stops (Type 0 or null)
            '#1e293b'
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': ['case',
            // 1. Transfer Stations (Type 1 + Special Name) -> BLACK stroke
            ['all',
                ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1],
                ['match', ['get', 'stop_name'], ['Můstek', 'Muzeum', 'Florenc'], true, false]
            ],
            '#000000',

            // 2. Other Stations (Type 1) -> WHITE stroke
            ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1],
            '#ffffff',

            // 3. Regular Stops (Type 0) -> BLUE stroke
            '#38bdf8'
        ]
    }
};

const transferStationLayer: any = {
    id: 'transfer-stations',
    type: 'symbol',
    source: 'pid-stops',
    filter: ['all',
        ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1],
        ['match', ['get', 'stop_name'], ['Můstek', 'Muzeum', 'Florenc'], true, false]
    ],
    minzoom: 10,
    layout: {
        'icon-image': ['match', ['get', 'stop_name'],
            'Můstek', 'transfer-A-B',
            'Muzeum', 'transfer-A-C',
            'Florenc', 'transfer-B-C',
            ''
        ],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.4, 15, 0.6],
        'icon-allow-overlap': true,
        'icon-offset': ['match', ['get', 'stop_name'],
            'Muzeum', ['literal', [0, -15]], // Shift Muzeum UP to avoid overlap
            ['literal', [0, 0]]
        ]
    }
};

const stopLabelLayer: any = {
    id: 'stop-labels',
    type: 'symbol',
    source: 'pid-stops',
    filter: ['all',
        ['!', ['has', 'point_count']],
        ['!=', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 2]
    ],
    minzoom: 10,
    layout: {
        'text-field': [
            'case',
            ['all',
                ['!=', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1],
                ['has', 'platform_code'],
                ['>', ['length', ['to-string', ['get', 'platform_code']]], 0]
            ],
            ['concat', ['get', 'stop_name'], ' (', ['get', 'platform_code'], ')'],
            ['get', 'stop_name']
        ],
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 10, 8, 16, 12],
        'text-offset': [0, 1.2],
        'text-anchor': 'top',
        'text-max-width': 10,
        'text-allow-overlap': false,
        'text-ignore-placement': false
    },
    paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#000000',
        'text-halo-width': 1
    }
};

const entranceLayer: any = {
    id: 'entrance-layer',
    type: 'symbol',
    source: 'pid-stops',
    filter: ['all',
        ['!', ['has', 'point_count']],
        ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 2]
    ],
    minzoom: 16,
    layout: {
        'text-field': ['get', 'stop_name'],
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-size': 11,
        'text-allow-overlap': true,
        'text-ignore-placement': true
    },
    paint: {
        'text-color': '#e2e8f0',
        'text-halo-color': '#0f172a',
        'text-halo-width': 1
    }
};

const INITIAL = (() => {
    const p = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    return {
        lat: parseFloat(p.get('lat') || '50.0755'),
        lng: parseFloat(p.get('lng') || '14.4378'),
        z: parseFloat(p.get('z') || '13')
    };
})();

export const Map: React.FC = () => {
    const mapRef = useRef<any>(null);
    const [bounds, setBounds] = useState<string | null>(null);
    const [debouncedBounds, setDebouncedBounds] = useState<string | null>(null);
    const [selectedStop, setSelectedStop] = useState<{ id: string; name: string } | null>(null);
    const [showVehicles, setShowVehicles] = useState(true);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [expandedLines, setExpandedLines] = useState<string[]>([]);
    const debounceRef = useRef<any>(null);

    const { data: rawVehicles, isFetching: fetchingVehicles } = useVehicles(debouncedBounds);
    const { data: stops } = useStops();
    const { data: departures, isLoading: loadingDeps } = useDepartures(selectedStop?.id || null);

    // Sync selectedStop with URL
    useEffect(() => {
        const p = new URLSearchParams(window.location.search);
        const id = p.get('stopId');
        const name = p.get('stopName');
        if (id && name && !selectedStop) {
            setSelectedStop({ id, name });
        }
    }, []);

    useEffect(() => {
        const url = new URL(window.location.href);
        if (selectedStop) {
            url.searchParams.set('stopId', selectedStop.id);
            url.searchParams.set('stopName', selectedStop.name);
        } else {
            url.searchParams.delete('stopId');
            url.searchParams.delete('stopName');
        }
        window.history.replaceState({}, '', url.toString());
    }, [selectedStop]);

    const onMove = useCallback((evt: any) => {
        const { zoom } = evt.viewState;
        const b = evt.target.getBounds();
        const currentBounds = b && zoom >= 11 ? `${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}` : null;

        // Only update bounds state if "validity" changes (i.e. crossing zoom threshold)
        // or if we really need immediate feedback. 
        // For LiveStatus which just checks if bounds exists, we don't need precise coords every frame.
        // However, to keep it simple and safe, we can just defer precise updates.
        // But useVehicles uses debounced.

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setDebouncedBounds(currentBounds);

            // Also update the UI 'bounds' here (debounced) to prevent frequent re-renders 
            // of LiveStatus during dragging. 
            // If instant feedback for zoom threshold is needed, we could separate that state.
            setBounds(currentBounds);
        }, 800);

        // If we need immediate reaction to Zoom < 11 (hiding the pill immediately), 
        // we can add a check here, but let's see if debouncing is enough.
        // Actually, if I zoom out fast, I want the pill to disappear.
        if (zoom < 11 && bounds !== null) {
            setBounds(null);
        } else if (zoom >= 11 && bounds === null) {
            // We can't easily get 'bounds' inside callback without deps. 
            // But we can just set it.
            setBounds(currentBounds);
        }
    }, [bounds]);

    const onMoveEnd = useCallback((evt: any) => {
        const { latitude, longitude, zoom } = evt.viewState;
        const b = evt.target.getBounds();
        const currentBounds = b && zoom >= 11 ? `${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}` : null;

        const url = new URL(window.location.href);
        url.searchParams.set('lat', latitude.toFixed(5));
        url.searchParams.set('lng', longitude.toFixed(5));
        url.searchParams.set('z', zoom.toFixed(2));
        window.history.replaceState({}, '', url.toString());

        // Ensure explicit set at end of move
        setBounds(currentBounds);
        setDebouncedBounds(currentBounds);
    }, []);

    const handleLocate = () => {
        console.log('🛰️ Štartujem manuálnu geolokáciu...');
        if (!navigator.geolocation) {
            alert('Tvoj prehliadač nepodporuje geolokáciu.');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                console.log('✅ Poloha nájdená:', latitude, longitude);
                mapRef.current?.getMap().flyTo({
                    center: [longitude, latitude],
                    zoom: 15,
                    duration: 2000
                });
            },
            (err) => {
                console.error('❌ Geolokácia zlyhala:', err);
                alert(`Chyba: ${err.message} (Kód: ${err.code}). Skontroluj nastavenia súkromia v macOS/Browseri.`);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };



    const onLoad = useCallback((evt: any) => {
        const map = evt.target;

        // Register custom Centered Bearing Arrow (SDF)
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, size, size);
            ctx.fillStyle = 'white';
            ctx.beginPath();
            // Sharper, compact arrow
            ctx.moveTo(32, 12);
            ctx.lineTo(18, 46);  // Slightly narrower
            ctx.lineTo(32, 38);  // Slightly shallower cut
            ctx.lineTo(46, 46);  // Slightly narrower
            ctx.closePath();
            ctx.fill();

            if (!map.hasImage('v-arrow-centered')) {
                const imageData = ctx.getImageData(0, 0, size, size);
                map.addImage('v-arrow-centered', imageData, { sdf: true });
            }
        }

        // Generate Split Icons for Transfers
        const addSplitIcon = (id: string, c1: string, c2: string) => {
            const size = 64;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const cx = size / 2;
                const cy = size / 2;
                const r = size / 2 - 4; // Margin for stroke

                // White border background
                ctx.beginPath();
                ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
                ctx.fillStyle = 'white';
                ctx.fill();

                // Left Half
                ctx.beginPath();
                ctx.arc(cx, cy, r, Math.PI * 0.5, Math.PI * 1.5);
                ctx.fillStyle = c1;
                ctx.fill();

                // Right Half
                ctx.beginPath();
                ctx.arc(cx, cy, r, Math.PI * 1.5, Math.PI * 2.5);
                ctx.fillStyle = c2;
                ctx.fill();

                if (!map.hasImage(id)) {
                    map.addImage(id, ctx.getImageData(0, 0, size, size), { pixelRatio: 2 });
                }
            }
        };

        // Register Transfer Icons
        addSplitIcon('transfer-A-B', '#00A562', '#DEBD29'); // Mustek (Green/Yellow)
        addSplitIcon('transfer-A-C', '#00A562', '#C6242D'); // Muzeum (Green/Red)
        addSplitIcon('transfer-B-C', '#DEBD29', '#C6242D'); // Florenc (Yellow/Red)

        const b = map.getBounds();
        const z = map.getZoom();
        if (b && z >= 11) {
            const initialBounds = `${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}`;
            setBounds(initialBounds);
            setDebouncedBounds(initialBounds);
        }
    }, []);

    const groupedDepartures = useMemo(() => {
        if (!departures?.departures) return [];
        const groups: Record<string, any[]> = {};
        departures.departures.forEach((dep: any) => {
            const key = dep.line;
            if (!groups[key]) groups[key] = [];
            groups[key].push(dep);
        });
        return Object.entries(groups).map(([line, deps]) => ({
            line,
            type: deps[0].type,
            departures: deps
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
                onMoveEnd={onMoveEnd}
                onLoad={onLoad}
                style={{ width: '100%', height: '100%' }}
                mapStyle={MAP_STYLE}
                mapLib={maplibregl}
                onMouseEnter={(evt) => {
                    const features = evt.features;
                    if (features?.length && features[0].layer.id !== 'entrance-layer') {
                        evt.target.getCanvas().style.cursor = 'pointer';
                    }
                }}
                onMouseLeave={(evt) => {
                    evt.target.getCanvas().style.cursor = '';
                }}
                onClick={(evt) => {
                    const f = evt.features?.[0];
                    if (!f || f.layer.id === 'entrance-layer') return;

                    if (f.layer.id === 'clusters') {
                        const clusterId = f.properties.cluster_id;
                        const source = mapRef.current.getMap().getSource('pid-stops');
                        source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
                            if (err) return;
                            mapRef.current.easeTo({
                                center: (f.geometry as any).coordinates,
                                zoom,
                                duration: 500
                            });
                        });
                        return;
                    }

                    if (f.layer.id === 'unclustered-point' || f.layer.id === 'transfer-stations') {
                        const pc = f.properties.platform_code;
                        const name = (pc && pc.trim().length > 0) ? `${f.properties.stop_name} (${pc})` : f.properties.stop_name;
                        setSelectedStop({ id: f.properties.stop_id, name });
                        setExpandedLines([]);
                    }
                }}
                interactiveLayerIds={['unclustered-point', 'clusters', 'transfer-stations']}
            >
                <div
                    className="absolute top-4 right-4 z-10 flex flex-col gap-2"
                    style={{
                        top: 'calc(1rem + env(safe-area-inset-top, 0px))',
                        right: 'calc(1rem + env(safe-area-inset-right, 0px))'
                    }}
                >
                    <button
                        onClick={handleLocate}
                        className="p-3 bg-black/40 backdrop-blur-md hover:bg-black/60 text-white rounded-2xl border border-white/10 shadow-2xl transition-all pointer-events-auto group"
                        title="My Location"
                    >
                        <LocateFixed size={20} className="group-hover:scale-110 transition-transform" />
                    </button>
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="p-3 bg-black/40 backdrop-blur-md hover:bg-black/60 text-white rounded-2xl border border-white/10 shadow-2xl transition-all pointer-events-auto group"
                        title="Settings"
                    >
                        <Settings size={20} className="group-hover:rotate-45 transition-transform" />
                    </button>
                </div>
                <NavigationControl position="bottom-right" showCompass={false} />


                {stopsData && (
                    <Source id="pid-stops" type="geojson" data={stopsData} cluster={true} clusterMaxZoom={13} clusterRadius={30}>
                        <Layer {...clusterLayer} />
                        <Layer {...clusterCountLayer} />
                        <Layer {...stopPointLayer} />
                        <Layer {...transferStationLayer} />
                        <Layer {...stopLabelLayer} />
                        <Layer {...entranceLayer} />
                    </Source>
                )}

                {showVehicles && rawVehicles && (
                    <Source id="pid-vehicles" type="geojson" data={rawVehicles}>
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

                        {/* BORDER LAYER - Solid white arrow shadow */}
                        <Layer
                            id="vehicles-direction-bg"
                            type="symbol"
                            minzoom={11}
                            layout={{
                                'icon-image': 'v-arrow-centered',
                                'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.3, 16, 0.5],
                                'icon-rotate': ['to-number', ['coalesce', ['get', 'bearing'], 0]],
                                'icon-rotation-alignment': 'map',
                                'icon-allow-overlap': true,
                                'icon-ignore-placement': true,
                                'icon-offset': [0, -48],
                                'icon-anchor': 'center'
                            }}
                            paint={{
                                'icon-color': '#FFFFFF'
                            }}
                        />

                        {/* FOREGROUND LAYER - Colored arrow */}
                        <Layer
                            id="vehicles-direction-fg"
                            type="symbol"
                            minzoom={11}
                            layout={{
                                'icon-image': 'v-arrow-centered',
                                'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.25, 16, 0.45],
                                'icon-rotate': ['to-number', ['coalesce', ['get', 'bearing'], 0]],
                                'icon-rotation-alignment': 'map',
                                'icon-allow-overlap': true,
                                'icon-ignore-placement': true,
                                'icon-offset': [0, -48],
                                'icon-anchor': 'center'
                            }}
                            paint={{
                                'icon-color': vehicleColorExpression
                            }}
                        />

                        <Layer
                            id="vehicles-label"
                            type="symbol"
                            minzoom={10}
                            layout={{
                                'text-field': ['to-string', ['coalesce', ['get', 'gtfs_route_short_name'], ['get', 'route_short_name'], '']],
                                'text-size': ['interpolate', ['linear'], ['zoom'], 10, 9, 16, 13],
                                'text-allow-overlap': true,
                                'text-ignore-placement': true,
                                'text-anchor': 'center'
                            }}
                            paint={{
                                'text-color': '#FFFFFF',
                                'text-halo-color': '#000000',
                                'text-halo-width': 1
                            }}
                        />
                    </Source>
                )}
            </MapGL>

            <WelcomeModal onGetStarted={handleLocate} />
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
                                <div className="flex items-center gap-3 px-1">
                                    <div
                                        className="px-3 py-1 rounded-lg font-bold text-white text-xs shadow-md"
                                        style={{ backgroundColor: getVehicleColor(group.type, group.line) }}
                                    >
                                        {group.line}
                                    </div>
                                    <div className="h-[1px] flex-1 bg-white/10" />
                                </div>

                                <div className="space-y-2">
                                    {visibleDepartures.map((dep: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col">
                                                    <div className="text-white font-semibold leading-tight">{dep.headsign}</div>
                                                    <div className="text-slate-500 text-[10px] mt-1 flex items-center gap-2">
                                                        <span>{format(parseISO(dep.scheduled), 'HH:mm')}</span>
                                                        {dep.delay > 30 && <span className="text-rose-400">+{Math.round(dep.delay / 60)}min delay</span>}
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
