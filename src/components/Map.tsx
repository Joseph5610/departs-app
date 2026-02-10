
import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import MapGL, { Source, Layer, type MapRef } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BottomSheet } from './BottomSheet';
import { Countdown } from './Countdown';
import { LiveStatus } from './LiveStatus';
import { vehicleColorExpression, getVehicleColor, isNightRouteExpression, isNightRoute } from '../utils/vehicleColors';
const SettingsModal = React.lazy(() => import('./SettingsModal').then(module => ({ default: module.SettingsModal })));
const WelcomeModal = React.lazy(() => import('./WelcomeModal').then(module => ({ default: module.WelcomeModal })));
const UpdatePopup = React.lazy(() => import('./UpdatePopup').then(module => ({ default: module.UpdatePopup })));
import { Search } from './Search';
import {
    clusterLayer,
    clusterCountLayer,
    stopPointLayer,
    transferStationLayer,
    stopLabelLayer,
    platformLabelLayer,
    entranceLayer,
    stopPointGlowLayer
} from '../config/mapLayers';
import { useMapLogic } from '../hooks/useMapLogic';
import type { TrackedVehicle } from '../types/transit';
import { format, parseISO } from 'date-fns';
import { cs } from 'date-fns/locale/cs';
import { enUS } from 'date-fns/locale/en-US';
import { MapControls } from './MapControls';
import { VehicleDetail } from './VehicleDetail';
import { ArrowDownAz, Clock } from 'lucide-react';

const EMPTY_GEOJSON: any = {
    type: 'FeatureCollection',
    features: []
};

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const INITIAL = (() => {
    const p = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    return {
        lat: parseFloat(p.get('lat') || '50.0755'),
        lng: parseFloat(p.get('lng') || '14.4378'),
        z: parseFloat(p.get('z') || '13')
    };
})();

const dateLocales: Record<string, any> = {
    cs: cs,
    en: enUS
};

export const Map: React.FC = () => {
    const { t, i18n } = useTranslation();
    const mapRef = useRef<MapRef>(null);

    const {
        bounds,
        selectedStop,
        selectedVehicle,
        isFollowing,
        showVehicles,
        isSettingsOpen,
        expandedGroups,
        setSelectedStop,
        setSelectedVehicle,
        setIsFollowing,
        setShowVehicles,
        setIsSettingsOpen,
        handleLocate,
        onMove,
        onMoveEnd,
        onLoad,
        onDragStart,
        handleDepartureClick,
        toggleGroup,
        setExpandedGroups,
        displayVehicles,
        vehicleDetail,
        loadingDetail,
        stopsData,
        labelData,
        groupedDepartures,
        stops,
        loadingDeps,
        routeShapeData,
        fetchingVehicles,
        dataUpdatedAt,
        departureSort,
        setDepartureSort,
        userLocation,
        mapLoaded,
        selectedVehicleFeature,
        labelLayerId,
        selectedId
    } = useMapLogic(mapRef);

    const handleZoomIn = () => {
        mapRef.current?.zoomIn();
    };

    const handleZoomOut = () => {
        mapRef.current?.zoomOut();
    };

    const handleResetBearing = () => {
        mapRef.current?.easeTo({
            bearing: 0,
            duration: 1000,
            pitch: 0
        });
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
                mapLib={maplibregl as any}
                onDragStart={onDragStart}
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
                        const source = (mapRef.current!.getMap() as any).getSource('pid-stops');
                        source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
                            if (err) return;
                            mapRef.current?.easeTo({
                                center: (f.geometry as any).coordinates,
                                zoom,
                                duration: 500
                            });
                        });
                        return;
                    }

                    if (f.layer.id === 'vehicles-point' || f.layer.id === 'vehicles-direction-fg' || f.layer.id === 'vehicles-label') {
                        const props = f.properties;
                        setSelectedVehicle({
                            ...props,
                            vehicle_id: String(props.vehicle_id || props.id),
                            _geometry: (f.geometry as any).coordinates as [number, number]
                        } as TrackedVehicle);
                        setSelectedStop(null);
                        setIsFollowing(true);
                        return;
                    }

                    if (f.layer.id === 'unclustered-point' || f.layer.id === 'transfer-stations') {
                        const pc = f.properties.platform_code;
                        const name = (pc && pc.trim().length > 0) ? `${f.properties.stop_name} (${pc})` : f.properties.stop_name;
                        setSelectedStop({ id: f.properties.stop_id, name });
                        setSelectedVehicle(null);
                        setExpandedGroups([]);
                    }
                }}
                interactiveLayerIds={['unclustered-point', 'clusters', 'transfer-stations', 'vehicles-point', 'vehicles-direction-fg', 'vehicles-label']}
            >

                {/* Route Shape Layer - PERSISTENT SOURCE (Optimization) */}
                {/* Placed UNDER labels thanks to beforeId */}
                {mapLoaded && (
                    <Source id="route-shape" type="geojson" data={routeShapeData || (EMPTY_GEOJSON as any)}>
                        <Layer
                            id="route-line"
                            type="line"
                            beforeId={labelLayerId} // Put under labels!
                            layout={{
                                'line-join': 'round',
                                'line-cap': 'round'
                            }}
                            paint={{
                                'line-color': isNightRoute(selectedVehicle?.gtfs_route_short_name || selectedVehicle?.route_short_name || selectedVehicle?.n || '') ? '#ffffff' : getVehicleColor(selectedVehicle?.route_type || selectedVehicle?.t || 0, selectedVehicle?.gtfs_route_short_name || selectedVehicle?.route_short_name || selectedVehicle?.n || ''),
                                'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 15, 8],
                                'line-opacity': 0.8,
                                'line-blur': 0.5
                            }}
                        />
                    </Source>
                )}

                <Search
                    stops={stops as any}
                    onSelect={(stop) => {
                        const [lng, lat] = stop.geometry.coordinates;
                        mapRef.current?.flyTo({
                            center: [lng, lat],
                            zoom: 16,
                            duration: 2000
                        });
                        const pc = stop.properties.platform_code;
                        const name = (pc && pc.trim().length > 0) ? `${stop.properties.stop_name} (${pc})` : stop.properties.stop_name;
                        setSelectedStop({ id: stop.properties.stop_id, name });
                        setSelectedVehicle(null);
                        setExpandedGroups([]);
                    }}
                />

                <MapControls
                    onLocate={handleLocate}
                    onSettings={() => setIsSettingsOpen(true)}
                    onZoomIn={handleZoomIn}
                    onZoomOut={handleZoomOut}
                    onResetBearing={handleResetBearing}
                />

                <Source id="user-location" type="geojson" data={(mapLoaded && userLocation ? {
                    type: 'FeatureCollection',
                    features: [{
                        type: 'Feature',
                        geometry: { type: 'Point', coordinates: userLocation },
                        properties: {}
                    }]
                } : EMPTY_GEOJSON) as any}>
                    <Layer
                        id="user-location-pulse"
                        type="circle"
                        paint={{
                            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 15, 15, 30],
                            'circle-color': '#3b82f6',
                            'circle-opacity': 0.15,
                        }}
                    />
                    <Layer
                        id="user-location-point"
                        type="circle"
                        paint={{
                            'circle-radius': 7,
                            'circle-color': '#3b82f6',
                            'circle-stroke-width': 2,
                            'circle-stroke-color': '#FFFFFF'
                        }}
                    />
                </Source>


                <Source id="selected-vehicle" type="geojson" data={selectedVehicleFeature as any}>
                    {/* 1. PULSE (Bottom) */}
                    <Layer
                        id="selected-vehicle-pulse"
                        type="circle"
                        paint={{
                            'circle-radius': 0, // Animated
                            'circle-opacity': 0, // Animated
                            'circle-color': vehicleColorExpression
                        }}
                    />
                    {/* 2. BODY */}
                    <Layer
                        id="selected-vehicle-point"
                        type="circle"
                        paint={{
                            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 15, 14],
                            'circle-color': vehicleColorExpression,
                            'circle-stroke-width': 1.5,
                            'circle-stroke-color': ['case', isNightRouteExpression, '#ffffff', '#000000'],
                            'circle-opacity': 1
                        }}
                    />
                    {/* 3. DIRECTION */}
                    <Layer
                        id="selected-vehicle-direction"
                        type="symbol"
                        layout={{
                            'icon-image': 'v-arrow-centered',
                            'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.2, 16, 0.4],
                            'icon-rotate': ['to-number', ['coalesce', ['get', 'bearing'], ['get', 'b'], 0]],
                            'icon-rotation-alignment': 'map',
                            'icon-allow-overlap': true,
                            'icon-ignore-placement': true,
                            'icon-offset': [0, -48],
                            'icon-anchor': 'center'
                        }}
                        paint={{
                            'icon-color': vehicleColorExpression,
                            'icon-opacity': 1
                        }}
                    />
                    {/* 4. LABEL */}
                    <Layer
                        id="selected-vehicle-label"
                        type="symbol"
                        layout={{
                            'text-field': ['to-string', ['coalesce', ['get', 'gtfs_route_short_name'], ['get', 'route_short_name'], ['get', 'n'], '']],
                            'text-font': ['Montserrat Medium', 'Arial Unicode MS Regular'],
                            'text-size': ['interpolate', ['linear'], ['zoom'], 10, 9, 16, 13],
                            'text-allow-overlap': true,
                            'text-ignore-placement': true,
                            'text-anchor': 'center'
                        }}
                        paint={{
                            'text-color': '#f8fafc',
                            'text-halo-color': '#000000',
                            'text-halo-width': 1.2,
                            'text-halo-blur': 0.4,
                            'text-opacity': 1
                        }}
                    />
                </Source>

                <Source id="pid-vehicles" type="geojson" data={(mapLoaded && showVehicles && displayVehicles ? displayVehicles : EMPTY_GEOJSON) as any}>
                    {/* Main Vehicles Layer - EXCLUDE SELECTED (By Vehicle ID OR Trip ID) */}
                    <Layer
                        id="vehicles-point"
                        type="circle"
                        minzoom={12}
                        filter={['!', ['any',
                            ['==', ['to-string', ['coalesce', ['get', 'vehicle_id'], ['get', 'id'], '']], String(selectedId || 'NOMATCH')],
                            ['==', ['to-string', ['coalesce', ['get', 'gtfs_trip_id'], ['get', 'trip_id'], '']], String(selectedVehicle?.gtfs_trip_id || selectedVehicle?.trip_id || 'NOMATCH')]
                        ]]}
                        paint={{
                            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 15, 14],
                            'circle-color': vehicleColorExpression,
                            'circle-stroke-width': 1.5,
                            'circle-stroke-color': ['case', isNightRouteExpression, '#ffffff', '#000000'],
                            'circle-opacity': 1
                        }}
                    />

                    {/* DIRECTION ARROWS - EXCLUDE SELECTED */}
                    <Layer
                        id="vehicles-direction-all"
                        type="symbol"
                        minzoom={12}
                        filter={['!', ['any',
                            ['==', ['to-string', ['coalesce', ['get', 'vehicle_id'], ['get', 'id'], '']], String(selectedId || 'NOMATCH')],
                            ['==', ['to-string', ['coalesce', ['get', 'gtfs_trip_id'], ['get', 'trip_id'], '']], String(selectedVehicle?.gtfs_trip_id || selectedVehicle?.trip_id || 'NOMATCH')]
                        ]]}
                        layout={{
                            'icon-image': 'v-arrow-centered',
                            'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.2, 16, 0.4],
                            'icon-rotate': ['to-number', ['coalesce', ['get', 'bearing'], ['get', 'b'], 0]],
                            'icon-rotation-alignment': 'map',
                            'icon-allow-overlap': true,
                            'icon-ignore-placement': true,
                            'icon-offset': [0, -48],
                            'icon-anchor': 'center'
                        }}
                        paint={{
                            'icon-color': vehicleColorExpression,
                            'icon-opacity': 1
                        }}
                    />

                    {/* LABELS - EXCLUDE SELECTED */}
                    <Layer
                        id="vehicles-label-all"
                        type="symbol"
                        minzoom={12}
                        filter={['!', ['any',
                            ['==', ['to-string', ['coalesce', ['get', 'vehicle_id'], ['get', 'id'], '']], String(selectedId || 'NOMATCH')],
                            ['==', ['to-string', ['coalesce', ['get', 'gtfs_trip_id'], ['get', 'trip_id'], '']], String(selectedVehicle?.gtfs_trip_id || selectedVehicle?.trip_id || 'NOMATCH')]
                        ]]}
                        layout={{
                            'text-field': ['to-string', ['coalesce', ['get', 'gtfs_route_short_name'], ['get', 'route_short_name'], ['get', 'n'], '']],
                            'text-font': ['Montserrat Medium', 'Arial Unicode MS Regular'],
                            'text-size': ['interpolate', ['linear'], ['zoom'], 10, 9, 16, 13],
                            'text-allow-overlap': true,
                            'text-ignore-placement': true,
                            'text-anchor': 'center'
                        }}
                        paint={{
                            'text-color': '#f8fafc',
                            'text-halo-color': '#000000',
                            'text-halo-width': 1.2,
                            'text-halo-blur': 0.4,
                            'text-opacity': 1
                        }}
                    />
                </Source>

                <Source
                    id="pid-stops"
                    type="geojson"
                    data={(mapLoaded && stopsData ? stopsData : EMPTY_GEOJSON) as any}
                    cluster={true}
                    clusterMaxZoom={13}
                    clusterRadius={40}
                    clusterProperties={{
                        has_metro_a: ['max', ['get', 'metro_a']],
                        has_metro_b: ['max', ['get', 'metro_b']],
                        has_metro_c: ['max', ['get', 'metro_c']],
                        cluster_seed: ['max', ['get', 'variant_seed']]
                    }}
                >
                    <Layer {...clusterLayer} />
                    <Layer {...clusterCountLayer} />
                    <Layer {...stopPointGlowLayer} />
                    <Layer {...stopPointLayer} />
                    <Layer {...transferStationLayer} />
                    <Layer {...platformLabelLayer} />
                    <Layer {...entranceLayer} />
                </Source>

                <Source id="stop-labels-centroids" type="geojson" data={(mapLoaded && labelData ? labelData : EMPTY_GEOJSON) as any}>
                    <Layer {...stopLabelLayer} />
                </Source>
            </MapGL>

            <React.Suspense fallback={null}>
                <WelcomeModal onGetStarted={handleLocate} />
                <SettingsModal
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    showVehicles={showVehicles}
                    setShowVehicles={setShowVehicles}
                />
                <UpdatePopup />
            </React.Suspense>

            <BottomSheet
                isOpen={!!selectedStop || !!selectedVehicle}
                onClose={() => { setSelectedStop(null); setSelectedVehicle(null); setIsFollowing(false); }}
                title={selectedStop ? selectedStop.name : (selectedVehicle && window.innerWidth >= 768 ? t('map.vehicleDetails.lineLabel', { line: selectedVehicle.gtfs_route_short_name || selectedVehicle.route_short_name || selectedVehicle.n }) : '')}
            >
                <div className="space-y-4 pt-1">
                    {selectedStop && (
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">{t('map.departures.upcoming')}</span>
                            <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/5">
                                <button
                                    onClick={() => setDepartureSort('line')}
                                    className={`p-1.5 rounded-lg transition-all ${departureSort === 'line' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    title="Sort by line"
                                >
                                    <ArrowDownAz size={14} />
                                </button>
                                <button
                                    onClick={() => setDepartureSort('departure')}
                                    className={`p-1.5 rounded-lg transition-all ${departureSort === 'departure' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    title="Sort by departure time"
                                >
                                    <Clock size={14} />
                                </button>
                            </div>
                        </div>
                    )}

                    <VehicleDetail
                        selectedVehicle={selectedVehicle}
                        vehicleDetail={vehicleDetail || null}
                        loadingDetail={loadingDetail}
                        isFollowing={isFollowing}
                        onToggleFollow={() => setIsFollowing(!isFollowing)}
                    />

                    {selectedStop && groupedDepartures.map((group, index) => {
                        const isExpanded = expandedGroups.includes(group.groupId);
                        const visibleDepartures = isExpanded ? group.departures : [group.departures[0]];
                        const hasMore = group.departures.length > 1;

                        const prevGroup = index > 0 ? groupedDepartures[index - 1] : null;
                        const showHeader = !prevGroup || String(prevGroup.line) !== String(group.line) || String(prevGroup.type) !== String(group.type);

                        return (
                            <div key={group.groupId} className={showHeader ? "space-y-3" : "space-y-3 -mt-1"}>
                                {showHeader && (
                                    <div className="flex items-center gap-3 px-1">
                                        <div
                                            className="px-3 py-1 rounded-lg font-bold text-white text-xs shadow-md"
                                            style={{ backgroundColor: getVehicleColor(group.type, group.line) }}
                                        >
                                            {group.line}
                                        </div>
                                        <div className="h-[1px] flex-1 bg-white/10" />
                                    </div>
                                )}

                                <div className="space-y-2">
                                    {visibleDepartures.map((dep: any, idx: number) => (
                                        <div
                                            key={idx}
                                            onClick={() => dep.tripId && handleDepartureClick(dep.tripId, dep.vehicleId, dep)}
                                            className={`flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 transition-all
                                                ${dep.tripId ? 'hover:bg-white/10 hover:border-white/20 cursor-pointer active:scale-[0.98]' : ''}
                                            `}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col">
                                                    <div className="text-white font-semibold leading-tight">{dep.headsign}</div>
                                                    <div className="text-zinc-500 text-[10px] mt-1 flex items-center gap-2">
                                                        <span>{format(parseISO(dep.scheduled), 'HH:mm', {
                                                            locale: dateLocales[i18n.resolvedLanguage || i18n.language] || enUS
                                                        })}</span>
                                                        {dep.delay > 30 && <span className="text-rose-400">{t('map.departures.delay', { minutes: Math.round(dep.delay / 60) })}</span>}
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
                                            onClick={() => toggleGroup(group.groupId)}
                                            className="w-full py-2 text-zinc-500 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:text-zinc-400 transition-colors"
                                        >
                                            <div className="h-[1px] flex-1 bg-white/5" />
                                            <span>{isExpanded ? t('map.departures.showLess') : t('map.departures.moreConnections', { count: group.departures.length - 1 })}</span>
                                            <div className="h-[1px] flex-1 bg-white/5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {selectedStop && groupedDepartures.length === 0 && !loadingDeps && (
                        <div className="py-12 text-center text-zinc-500">{t('map.departures.noUpcoming')}</div>
                    )}
                </div>
            </BottomSheet>
        </div>
    );
};
