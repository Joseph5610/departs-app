import React, { useRef } from 'react';
import MapGL, { Source, Layer, NavigationControl, type MapRef } from 'react-map-gl/maplibre';
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
import { Settings, LocateFixed, Snowflake, Accessibility, Info, MapPin } from 'lucide-react';
import {
    clusterLayer,
    clusterCountLayer,
    stopPointLayer,
    transferStationLayer,
    stopLabelLayer,
    entranceLayer
} from '../config/mapLayers';
import { useMapLogic } from '../hooks/useMapLogic';
import { format, parseISO } from 'date-fns';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const INITIAL = (() => {
    const p = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    return {
        lat: parseFloat(p.get('lat') || '50.0755'),
        lng: parseFloat(p.get('lng') || '14.4378'),
        z: parseFloat(p.get('z') || '13')
    };
})();

export const Map: React.FC = () => {
    const mapRef = useRef<MapRef>(null);

    const {
        bounds,
        selectedStop,
        selectedVehicle,
        isFollowing,
        showVehicles,
        isSettingsOpen,
        expandedLines,
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
        toggleLine,
        setExpandedLines,
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
                        setExpandedLines([]);
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
                        setExpandedLines([]);
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
                title={selectedStop ? selectedStop.name : (selectedVehicle && window.innerWidth >= 768 ? `Line ${selectedVehicle.gtfs_route_short_name || selectedVehicle.route_short_name || selectedVehicle.n}` : '')}
            >
                <div className="space-y-4 pt-1">
                    {selectedVehicle && (
                        <div className="space-y-4">
                            {/* Loading State */}
                            {loadingDetail && !vehicleDetail && (
                                <div className="py-8 flex flex-col items-center justify-center gap-3">
                                    <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Fetching live details...</span>
                                </div>
                            )}

                            {/* Warning: Before Track / Previous Trip */}
                            {(['before_track', 'before_track_delayed'].includes(selectedVehicle.state_position) || ['before_track', 'before_track_delayed'].includes(vehicleDetail?.state_position || '')) && (
                                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-4">
                                    <div className="p-2 bg-amber-500/20 rounded-full text-amber-500 shrink-0">
                                        <Info size={20} />
                                    </div>
                                    <div>
                                        <h4 className="text-amber-500 font-bold text-sm">Vehicle is performing a previous trip</h4>
                                        <p className="text-amber-500/80 text-xs mt-1 leading-relaxed">
                                            The vehicle hasn't started this specific trip yet. The location shown might be from its previous service.
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
                                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 md:w-6 md:h-6 rounded-full border-2 border-black flex items-center justify-center transition-colors ${isFollowing ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                                        <MapPin size={isFollowing ? 10 : 12} className="text-white" />
                                    </div>
                                </div>
                                <div className="z-10 flex-1 min-w-0 md:w-full">
                                    <h3 className="text-lg md:text-xl font-bold text-white mb-1 truncate">
                                        {vehicleDetail?.trip_headsign || selectedVehicle.gtfs_trip_headsign || selectedVehicle.trip_headsign || selectedVehicle.next_stop_name || 'Heading to destination'}
                                    </h3>
                                    <div className="flex items-center md:justify-center gap-2">
                                        <StatusPill
                                            variant={(vehicleDetail?.delay ?? selectedVehicle.delay ?? selectedVehicle.d ?? 0) > 30 ? 'danger' : 'success'}
                                            label={(vehicleDetail?.delay ?? selectedVehicle.delay ?? selectedVehicle.d ?? 0) > 30
                                                ? `Delay ${Math.round((vehicleDetail?.delay ?? selectedVehicle.delay ?? selectedVehicle.d ?? 0) / 60)} min`
                                                : 'On time'}
                                        />
                                        {vehicleDetail?.vehicle_descriptor?.is_air_conditioned && (
                                            <StatusPill
                                                variant="info"
                                                label="AC"
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
                                    <div className="text-white font-mono text-xs truncate">{selectedVehicle.vehicle_id || selectedVehicle.id || 'N/A'}</div>
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
