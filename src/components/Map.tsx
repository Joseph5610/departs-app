import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import MapGL, { Source, Layer, NavigationControl } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useVehicles } from '../hooks/useVehicles';
import { useVehicleDetail } from '../hooks/useVehicleDetail';
import { useStops } from '../hooks/useStops';
import { BottomSheet } from './BottomSheet';
import { useDepartures } from '../hooks/useDepartures';
import { format, parseISO } from 'date-fns';
import { Countdown } from './Countdown';
import { LiveStatus } from './LiveStatus';
import { vehicleColorExpression, getVehicleColor } from '../utils/vehicleColors';
import { SettingsModal } from './SettingsModal';
import { WelcomeModal } from './WelcomeModal';
import { UpdatePopup } from './UpdatePopup';
import { Settings, LocateFixed, Snowflake, Accessibility, Info, MapPin } from 'lucide-react';

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
    const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
    const [isFollowing, setIsFollowing] = useState(false);
    const [showVehicles, setShowVehicles] = useState(true);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [expandedLines, setExpandedLines] = useState<string[]>([]);
    const debounceRef = useRef<any>(null);

    const { data: rawVehicles, isFetching: fetchingVehicles, dataUpdatedAt } = useVehicles(debouncedBounds);
    const { data: vehicleDetail, isFetching: loadingDetail } = useVehicleDetail(
        selectedVehicle?.vehicle_id,
        selectedVehicle?.gtfs_trip_id
    );
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

    // Auto-following logic: Keep map centered on selected vehicle
    useEffect(() => {
        if (!isFollowing || !selectedVehicle || !rawVehicles || !mapRef.current) return;

        const vehicleFeature = rawVehicles.features.find(
            (f: any) => f.properties.vehicle_id === selectedVehicle.vehicle_id
        );

        if (vehicleFeature) {
            const [lng, lat] = vehicleFeature.geometry.coordinates;
            const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

            mapRef.current.easeTo({
                center: [lng, lat],
                duration: 1000,
                essential: true,
                // On mobile, push the center up by adding bottom padding to account for the BottomSheet
                padding: isMobile ? { bottom: window.innerHeight / 2.2, top: 0, left: 0, right: 0 } : { bottom: 0, top: 0, left: 0, right: 0 }
            });
        }
    }, [rawVehicles, isFollowing, selectedVehicle]);

    // Pulsing animation for selected vehicle
    useEffect(() => {
        let frame: number;
        const animate = () => {
            const map = mapRef.current?.getMap();
            if (map && selectedVehicle && isFollowing) {
                const time = Date.now() / 350;
                const radius = 30 + Math.sin(time) * 30; // Pulsates between 0 and 60
                const opacity = 0.9 - (radius / 80); // Max 0.9

                try {
                    if (map.getLayer('vehicles-pulse')) {
                        map.setPaintProperty('vehicles-pulse', 'circle-radius', radius);
                        map.setPaintProperty('vehicles-pulse', 'circle-opacity', Math.max(0.1, opacity));
                    }
                } catch (e) {
                    // Layer might not be ready yet
                }
            }
            frame = requestAnimationFrame(animate);
        };

        if (selectedVehicle && isFollowing) {
            frame = requestAnimationFrame(animate);
        }

        return () => {
            cancelAnimationFrame(frame);
            // Cleanup pulse layer when tracking stops
            const map = mapRef.current?.getMap();
            if (map && map.getLayer('vehicles-pulse')) {
                try {
                    map.setPaintProperty('vehicles-pulse', 'circle-radius', 0);
                    map.setPaintProperty('vehicles-pulse', 'circle-opacity', 0);
                } catch (e) {
                    // Silently fail if map is being unmounted
                }
            }
        };
    }, [selectedVehicle, isFollowing]);

    const onMove = useCallback((evt: any) => {
        const { zoom } = evt.viewState;

        // If this is a programmatic move (like easeTo in auto-follow),
        // we MUST ignore it, otherwise we get an infinite refresh loop.
        if (!evt.originalEvent) return;

        // If user is manually moving, stop following
        if (isFollowing) {
            setIsFollowing(false);
        }

        const b = evt.target.getBounds();

        // Round to 3 decimal places (~100m) to increase cache hit ratio
        const round = (num: number) => Math.round(num * 1000) / 1000;
        const currentBounds = b && zoom >= 11
            ? `${round(b.getSouth())},${round(b.getWest())},${round(b.getNorth())},${round(b.getEast())}`
            : null;

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setDebouncedBounds(currentBounds);
            setBounds(currentBounds);
        }, 1000);

        // Immediate reaction for zoom threshold
        if (zoom < 11 && bounds !== null) {
            setBounds(null);
        }
    }, [bounds, isFollowing]);

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
            <LiveStatus fetching={fetchingVehicles} bounds={bounds} lastUpdate={dataUpdatedAt} />

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

                    if (f.layer.id === 'vehicles-point' || f.layer.id === 'vehicles-direction-fg' || f.layer.id === 'vehicles-label') {
                        setSelectedVehicle(f.properties);
                        setSelectedStop(null);
                        setIsFollowing(true); // Auto-start following on selection
                        return;
                    }

                    if (f.layer.id === 'unclustered-point' || f.layer.id === 'transfer-stations') {
                        const pc = f.properties.platform_code;
                        const name = (pc && pc.trim().length > 0) ? `${f.properties.stop_name} (${pc})` : f.properties.stop_name;
                        setSelectedStop({ id: f.properties.stop_id, name });
                        setSelectedVehicle(null);
                        setExpandedLines([]);
                    }
                }}
                interactiveLayerIds={['unclustered-point', 'clusters', 'transfer-stations', 'vehicles-point', 'vehicles-direction-fg', 'vehicles-label']}
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
                        {/* Pulse Effect for selected vehicle */}
                        <Layer
                            id="vehicles-pulse"
                            type="circle"
                            filter={['all', ['==', ['get', 'vehicle_id'], selectedVehicle?.vehicle_id || 'NONE'], ['literal', isFollowing]]}
                            paint={{
                                'circle-radius': 0,
                                'circle-color': vehicleColorExpression,
                                'circle-opacity': 0,
                                'circle-blur': 0.4
                            }}
                        />
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
            <UpdatePopup />

            <BottomSheet
                isOpen={!!selectedStop || !!selectedVehicle}
                onClose={() => { setSelectedStop(null); setSelectedVehicle(null); setIsFollowing(false); }}
                title={selectedStop ? selectedStop.name : (selectedVehicle ? `Line ${selectedVehicle.gtfs_route_short_name || selectedVehicle.route_short_name}` : '')}
            >
                <div className="space-y-6 pt-2">
                    {selectedVehicle && (
                        <div className="space-y-6">
                            {/* Loading State */}
                            {loadingDetail && !vehicleDetail && (
                                <div className="py-8 flex flex-col items-center justify-center gap-3">
                                    <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Fetching live details...</span>
                                </div>
                            )}

                            <div className="flex flex-row md:flex-col items-center md:text-center p-4 md:p-8 bg-white/5 rounded-3xl border border-white/10 relative overflow-hidden gap-4 md:gap-6">
                                <div
                                    className="absolute inset-0 opacity-10"
                                    style={{ backgroundColor: getVehicleColor(selectedVehicle.route_type, selectedVehicle.gtfs_route_short_name || selectedVehicle.route_short_name) }}
                                />
                                <div
                                    className="w-14 h-14 md:w-20 md:h-20 shrink-0 rounded-2xl flex flex-col items-center justify-center shadow-2xl z-10 relative group cursor-pointer"
                                    style={{ backgroundColor: getVehicleColor(selectedVehicle.route_type, selectedVehicle.gtfs_route_short_name || selectedVehicle.route_short_name) }}
                                    onClick={() => setIsFollowing(!isFollowing)}
                                >
                                    <span className="text-2xl md:text-3xl font-black text-white">{selectedVehicle.gtfs_route_short_name || selectedVehicle.route_short_name}</span>
                                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 md:w-6 md:h-6 rounded-full border-2 border-black flex items-center justify-center transition-colors ${isFollowing ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                                        <MapPin size={isFollowing ? 10 : 12} className="text-white" />
                                    </div>
                                </div>
                                <div className="z-10 flex-1 min-w-0 md:w-full">
                                    <h3 className="text-lg md:text-xl font-bold text-white mb-1 truncate">
                                        {vehicleDetail?.trip_headsign || selectedVehicle.gtfs_trip_headsign || selectedVehicle.trip_headsign || selectedVehicle.next_stop_name || 'Heading to destination'}
                                    </h3>
                                    <div className="flex items-center md:justify-center gap-2">
                                        <div className={`px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-widest ${(vehicleDetail?.delay ?? selectedVehicle.delay ?? 0) > 30 ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                                            }`}>
                                            {(vehicleDetail?.delay ?? selectedVehicle.delay ?? 0) > 30
                                                ? `Delay ${Math.round((vehicleDetail?.delay ?? selectedVehicle.delay ?? 0) / 60)} min`
                                                : 'On time'}
                                        </div>
                                        {vehicleDetail?.vehicle_descriptor?.is_air_conditioned && (
                                            <div className="p-1 px-2 bg-sky-500/20 text-sky-400 rounded-full flex items-center gap-1">
                                                <Snowflake size={10} />
                                                <span className="text-[10px] font-bold">AC</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Operator & Vehicle Info - Compact on mobile */}
                            {vehicleDetail?.vehicle_descriptor?.operator && (
                                <div className="flex flex-row items-center justify-between md:p-4 p-1 md:bg-white/5 md:border md:border-white/5 rounded-2xl">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white/5 rounded-xl text-slate-400 hidden md:block">
                                            <Info size={16} />
                                        </div>
                                        <div className="flex flex-col md:block">
                                            <div className="text-white text-sm font-semibold hidden md:block">
                                                {vehicleDetail.vehicle_descriptor.operator}
                                            </div>
                                            <div className="text-slate-500 text-[10px]">
                                                <span className="md:hidden font-bold text-slate-400">{vehicleDetail.vehicle_descriptor.operator} • </span>
                                                {vehicleDetail.vehicle_descriptor.vehicle_type || 'Vehicle'}
                                                {vehicleDetail.vehicle_descriptor.vehicle_registration_number ? ` • #${vehicleDetail.vehicle_descriptor.vehicle_registration_number}` : ''}
                                            </div>
                                        </div>
                                    </div>
                                    {vehicleDetail.vehicle_descriptor.is_wheelchair_accessible && (
                                        <div className="text-emerald-500 shrink-0">
                                            <Accessibility size={16} />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Itinerary - ONLY if available */}
                            {vehicleDetail?.stop_times?.features && vehicleDetail.stop_times.features.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between px-1">
                                        <span className="text-slate-500 text-[10px] uppercase font-black tracking-widest">Route Schedule</span>
                                    </div>
                                    <div className="space-y-0.5 relative pl-4">
                                        <div className="absolute left-1 top-2 bottom-6 w-0.5 bg-white/10" />

                                        {vehicleDetail.stop_times.features
                                            .filter(s => s.properties.stop_sequence > (vehicleDetail.last_stop_sequence || 0))
                                            .slice(0, 3)
                                            .map((stop, idx) => (
                                                <div key={idx} className="relative py-2 flex items-center justify-between">
                                                    <div className="absolute -left-3.5 w-1.5 h-1.5 rounded-full bg-white/30 border border-black" />
                                                    <span className="text-slate-200 text-sm font-medium truncate pr-4">{stop.properties.stop_name}</span>
                                                    <span className="text-slate-500 text-xs font-mono shrink-0">{stop.properties.arrival_time?.slice(0, 5)}</span>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}

                            {/* Basic Metadata - Desktop only to save space on mobile */}
                            <div className="hidden md:grid grid-cols-2 gap-4">
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <div className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-1">Vehicle ID</div>
                                    <div className="text-white font-mono text-xs truncate">{selectedVehicle.vehicle_id || 'N/A'}</div>
                                </div>
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <div className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-1">Status</div>
                                    <div className="text-white text-xs capitalize">{selectedVehicle.state_position?.replace(/_/g, ' ') || 'In transit'}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {selectedStop && groupedDepartures.map((group) => {
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

                    {selectedStop && groupedDepartures.length === 0 && !loadingDeps && (
                        <div className="py-12 text-center text-slate-500">No upcoming departures found.</div>
                    )}
                </div>
            </BottomSheet>
        </div>
    );
};
