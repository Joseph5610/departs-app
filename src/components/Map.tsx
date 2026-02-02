import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import MapGL, { Source, Layer, type MapRef } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BottomSheet } from './BottomSheet';
import { Countdown } from './Countdown';
import { LiveStatus } from './LiveStatus';
import { vehicleColorExpression, getVehicleColor } from '../utils/vehicleColors';
import { SettingsModal } from './SettingsModal';
import { WelcomeModal } from './WelcomeModal';
import { UpdatePopup } from './UpdatePopup';
import { Search } from './Search';
import { StatusPill } from './StatusPill';
import { Settings, LocateFixed, Snowflake, Accessibility, Info, MapPin, Plus, Minus } from 'lucide-react';
import {
    clusterLayer,
    clusterCountLayer,
    stopPointLayer,
    transferStationLayer,
    stopLabelLayer,
    platformLabelLayer,
    entranceLayer
} from '../config/mapLayers';
import { useMapLogic } from '../hooks/useMapLogic';
import { format, parseISO } from 'date-fns';
import { cs } from 'date-fns/locale/cs';
import { enUS } from 'date-fns/locale/en-US';

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
        groupedDepartures,
        stops,
        loadingDeps,
        routeShapeData,
        fetchingVehicles,
        dataUpdatedAt
    } = useMapLogic(mapRef);

    const handleZoomIn = () => {
        mapRef.current?.zoomIn();
    };

    const handleZoomOut = () => {
        mapRef.current?.zoomOut();
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
                mapLib={maplibregl as any} // Cast as any if type mismatch persists
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
                        // Note: mapRef.current is MapRef, getMap() returns MapLibre map instance. 
                        // getSource might return a type that doesn't have getClusterExpansionZoom in basic types, but it exists on GeoJSONSource.
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
                        setExpandedGroups([]);
                    }
                }}
                interactiveLayerIds={['unclustered-point', 'clusters', 'transfer-stations', 'vehicles-point', 'vehicles-direction-fg', 'vehicles-label']}
            >
                {/* Route Shape Layer - Absolute bottom (rendered first) */}
                {routeShapeData && (
                    <Source id="route-shape" type="geojson" data={routeShapeData}>
                        <Layer
                            id="route-line"
                            type="line"
                            layout={{
                                'line-join': 'round',
                                'line-cap': 'round'
                            }}
                            paint={{
                                'line-color': getVehicleColor(selectedVehicle?.route_type || selectedVehicle?.t, selectedVehicle?.gtfs_route_short_name || selectedVehicle?.route_short_name || selectedVehicle?.n),
                                'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 15, 8],
                                'line-opacity': 0.6,
                                'line-blur': 1
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

                <div
                    className="absolute top-4 right-4 z-10 flex flex-col gap-2"
                    style={{
                        top: 'calc(1rem + env(safe-area-inset-top, 0px))',
                        right: 'calc(1rem + env(safe-area-inset-right, 0px))'
                    }}
                >
                    <button
                        onClick={handleLocate}
                        className="p-3 bg-black/90 backdrop-blur-md hover:bg-black/80 text-white rounded-2xl border border-white/10 shadow-2xl transition-all pointer-events-auto group"
                        title={t('map.controls.myLocation')}
                    >
                        <LocateFixed size={20} className="group-hover:scale-110 transition-transform" />
                    </button>
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="p-3 bg-black/90 backdrop-blur-md hover:bg-black/80 text-white rounded-2xl border border-white/10 shadow-2xl transition-all pointer-events-auto group"
                        title={t('map.controls.settings')}
                    >
                        <Settings size={20} className="group-hover:rotate-45 transition-transform" />
                    </button>

                    <div className="flex flex-col bg-black/90 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl mt-2 overflow-hidden">
                        <button
                            onClick={handleZoomIn}
                            className="p-3 text-white hover:bg-white/5 transition-colors pointer-events-auto group"
                            title={t('map.controls.zoomIn')}
                        >
                            <Plus size={20} className="group-hover:scale-110 transition-transform" />
                        </button>
                        <div className="mx-2 h-[1px] bg-white/10" />
                        <button
                            onClick={handleZoomOut}
                            className="p-3 text-white hover:bg-white/5 transition-colors pointer-events-auto group"
                            title={t('map.controls.zoomOut')}
                        >
                            <Minus size={20} className="group-hover:scale-110 transition-transform" />
                        </button>
                    </div>
                </div>

                {stopsData && (
                    <Source id="pid-stops" type="geojson" data={stopsData} cluster={true} clusterMaxZoom={13} clusterRadius={30}>
                        <Layer {...clusterLayer} />
                        <Layer {...clusterCountLayer} />
                        <Layer {...stopPointLayer} />
                        <Layer {...platformLabelLayer} />
                        <Layer {...transferStationLayer} />
                        <Layer {...stopLabelLayer} />
                        <Layer {...entranceLayer} />
                    </Source>
                )}

                {showVehicles && displayVehicles && (
                    <Source id="pid-vehicles" type="geojson" data={displayVehicles}>
                        {/* Pulse Effect for selected vehicle */}
                        <Layer
                            id="vehicles-pulse"
                            type="circle"
                            filter={['all', ['==', ['coalesce', ['get', 'vehicle_id'], ['get', 'id']], selectedVehicle?.vehicle_id || selectedVehicle?.id || 'NONE'], ['literal', isFollowing]]}
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
                            filter={isFollowing && selectedVehicle ? ['==', ['coalesce', ['get', 'vehicle_id'], ['get', 'id']], selectedVehicle.vehicle_id || selectedVehicle.id] : ['all']}
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
                            filter={isFollowing && selectedVehicle ? ['==', ['coalesce', ['get', 'vehicle_id'], ['get', 'id']], selectedVehicle.vehicle_id || selectedVehicle.id] : ['all']}
                            layout={{
                                'icon-image': 'v-arrow-centered',
                                'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.3, 16, 0.5],
                                'icon-rotate': ['to-number', ['coalesce', ['get', 'bearing'], ['get', 'b'], 0]],
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
                            filter={isFollowing && selectedVehicle ? ['==', ['coalesce', ['get', 'vehicle_id'], ['get', 'id']], selectedVehicle.vehicle_id || selectedVehicle.id] : ['all']}
                            layout={{
                                'icon-image': 'v-arrow-centered',
                                'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.25, 16, 0.45],
                                'icon-rotate': ['to-number', ['coalesce', ['get', 'bearing'], ['get', 'b'], 0]],
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
                            filter={isFollowing && selectedVehicle ? ['==', ['coalesce', ['get', 'vehicle_id'], ['get', 'id']], selectedVehicle.vehicle_id || selectedVehicle.id] : ['all']}
                            layout={{
                                'text-field': ['to-string', ['coalesce', ['get', 'gtfs_route_short_name'], ['get', 'route_short_name'], ['get', 'n'], '']],
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
                title={selectedStop ? selectedStop.name : (selectedVehicle && window.innerWidth >= 768 ? t('map.vehicleDetails.lineLabel', { line: selectedVehicle.gtfs_route_short_name || selectedVehicle.route_short_name || selectedVehicle.n }) : '')}
            >
                <div className="space-y-4 pt-1">
                    {selectedVehicle && (
                        <div className="space-y-4">
                            {/* Loading State */}
                            {loadingDetail && !vehicleDetail && (
                                <div className="py-8 flex flex-col items-center justify-center gap-3">
                                    <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                                    <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">{t('map.vehicleDetails.fetching')}</span>
                                </div>
                            )}

                            {/* Warning: Before Track / Previous Trip */}
                            {(['before_track', 'before_track_delayed'].includes(selectedVehicle.state_position) || ['before_track', 'before_track_delayed'].includes(vehicleDetail?.state_position || '')) && (
                                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-4">
                                    <div className="p-2 bg-amber-500/20 rounded-full text-amber-500 shrink-0">
                                        <Info size={20} />
                                    </div>
                                    <div>
                                        <h4 className="text-amber-500 font-bold text-sm">{t('map.vehicleDetails.previousTrip')}</h4>
                                        <p className="text-amber-500/80 text-xs mt-1 leading-relaxed">
                                        {t('map.vehicleDetails.previousTripDescription')}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-row md:flex-col items-center md:text-center p-4 md:p-8 bg-white/5 rounded-3xl border border-white/10 relative overflow-hidden gap-4 md:gap-6">
                                <div
                                    className="absolute inset-0 opacity-10"
                                    style={{ backgroundColor: getVehicleColor(selectedVehicle.route_type || selectedVehicle.t, selectedVehicle.gtfs_route_short_name || selectedVehicle.route_short_name || selectedVehicle.n) }}
                                />
                                <div
                                    className="w-14 h-14 md:w-20 md:h-20 shrink-0 rounded-2xl flex flex-col items-center justify-center shadow-2xl z-10 relative group cursor-pointer"
                                    style={{ backgroundColor: getVehicleColor(selectedVehicle.route_type || selectedVehicle.t, selectedVehicle.gtfs_route_short_name || selectedVehicle.route_short_name || selectedVehicle.n) }}
                                    onClick={() => setIsFollowing(!isFollowing)}
                                >
                                    <span className="text-2xl md:text-3xl font-black text-white">{selectedVehicle.gtfs_route_short_name || selectedVehicle.route_short_name || selectedVehicle.n}</span>
                                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 md:w-6 md:h-6 rounded-full border-2 border-black flex items-center justify-center transition-colors ${isFollowing ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                                        <MapPin size={isFollowing ? 10 : 12} className="text-white" />
                                    </div>
                                </div>
                                <div className="z-10 flex-1 min-w-0 md:w-full">
                                    <h3 className="text-lg md:text-xl font-bold text-white mb-1 truncate">
                                        {vehicleDetail?.trip_headsign || selectedVehicle.gtfs_trip_headsign || selectedVehicle.trip_headsign || selectedVehicle.next_stop_name || t('map.vehicleDetails.headingToDestination')}
                                    </h3>
                                    <div className="flex items-center md:justify-center gap-2">
                                        <StatusPill
                                            variant={(vehicleDetail?.delay ?? selectedVehicle.delay ?? selectedVehicle.d ?? 0) > 30 ? 'danger' : 'success'}
                                            label={(vehicleDetail?.delay ?? selectedVehicle.delay ?? selectedVehicle.d ?? 0) > 30
                                                ? t('map.vehicleDetails.delayLabel', { minutes: Math.round((vehicleDetail?.delay ?? selectedVehicle.delay ?? selectedVehicle.d ?? 0) / 60) })
                                                : t('map.vehicleDetails.onTime')}
                                        />
                                        {vehicleDetail?.vehicle_descriptor?.is_air_conditioned && (
                                            <StatusPill
                                                variant="info"
                                                label={t('map.vehicleDetails.ac')}
                                                icon={<Snowflake size={10} />}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Operator & Vehicle Info - Compact on mobile */}
                            {vehicleDetail?.vehicle_descriptor?.operator && (
                                <div className="flex flex-row items-center justify-between md:p-4 p-1 md:bg-white/5 md:border md:border-white/5 rounded-2xl">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white/5 rounded-xl text-zinc-400 hidden md:block">
                                            <Info size={16} />
                                        </div>
                                        <div className="flex flex-col md:block">
                                            <div className="text-white text-sm font-semibold hidden md:block">
                                                {vehicleDetail.vehicle_descriptor.operator}
                                            </div>
                                            <div className="text-zinc-500 text-[10px]">
                                                <span className="md:hidden font-bold text-zinc-400">{t('map.vehicleDetails.operator', { operator: vehicleDetail.vehicle_descriptor.operator })}</span>
                                                {vehicleDetail.vehicle_descriptor.vehicle_type || t('map.vehicleDetails.vehicle')}
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
                                        <span className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">{t('map.vehicleDetails.routeSchedule')}</span>
                                    </div>
                                    <div className="space-y-0.5 relative pl-4">
                                        <div className="absolute left-1 top-2 bottom-6 w-0.5 bg-white/10" />

                                        {vehicleDetail.stop_times.features
                                            .filter(s => s.properties.stop_sequence > (vehicleDetail.last_stop_sequence || 0))
                                            .slice(0, 3)
                                            .map((stop, idx) => (
                                                <div key={idx} className="relative py-2 flex items-center justify-between">
                                                    <div className="absolute -left-3.5 w-1.5 h-1.5 rounded-full bg-white/30 border border-black" />
                                                    <span className="text-zinc-200 text-sm font-medium truncate pr-4">{stop.properties.stop_name}</span>
                                                    <span className="text-zinc-500 text-xs font-mono shrink-0">{stop.properties.arrival_time?.slice(0, 5)}</span>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}

                            {/* Basic Metadata - Desktop only to save space on mobile */}
                            <div className="hidden md:grid grid-cols-2 gap-4">
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <div className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-1">{t('map.vehicleDetails.vehicleId')}</div>
                                    <div className="text-white font-mono text-xs truncate">{selectedVehicle.vehicle_id || selectedVehicle.id || t('map.vehicleDetails.notAvailable')}</div>
                                </div>
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <div className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-1">{t('map.vehicleDetails.status')}</div>
                                    <div className="text-white text-xs capitalize">{selectedVehicle.state_position?.replace(/_/g, ' ') || t('map.vehicleDetails.inTransit')}</div>
                                </div>
                            </div>
                        </div>
                    )}

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
                                            onClick={() => dep.tripId && handleDepartureClick(dep.tripId)}
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
