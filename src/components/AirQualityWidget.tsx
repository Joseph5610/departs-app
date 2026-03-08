import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Wind } from 'lucide-react';
import { useAirQuality } from '../hooks/useAirQuality';
import { useMap } from '../hooks/useMap';
import { cn } from '../utils/cn';

/**
 * AirQualityWidget displays the nearest air quality station data.
 * It uses the map center to determine the closest station.
 */
export const AirQualityWidget: React.FC = () => {
    const { t } = useTranslation();
    const { state, mapRef } = useMap();
    const { data: aqData } = useAirQuality();
    const { showAirQuality } = state;

    // Determine the nearest station to the center of the map
    const nearestStation = useMemo(() => {
        if (!aqData?.features || aqData.features.length === 0) return null;

        const map = state.mapLoaded ? mapRef.current?.getMap() : null;
        const center = map ? [map.getCenter().lng, map.getCenter().lat] : (state.userLocation || [14.4378, 50.0755]);

        return aqData.features.reduce((prev: any, curr: any) => {
            const dist = (coords: [number, number]) =>
                Math.sqrt(Math.pow(coords[0] - center[0], 2) + Math.pow(coords[1] - center[1], 2));

            return dist(curr.geometry.coordinates) < dist(prev.geometry.coordinates) ? curr : prev;
        });
    }, [aqData, state.userLocation, state.mapLoaded, mapRef]);

    if (!showAirQuality || !nearestStation) return null;

    const index = nearestStation.properties.measurement?.AQ_hourly_index;
    const stationName = nearestStation.properties.name;

    const getIndexColor = (idx: number) => {
        switch (idx) {
            case 1: return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
            case 2: return 'text-lime-400 bg-lime-500/10 border-lime-500/20';
            case 3: return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
            case 4: return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
            case 5: return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
            case 6: return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
            default: return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.9, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9, x: 20 }}
                className={cn(
                    "absolute right-4 top-4 z-10 flex items-center gap-3 px-3 py-2 rounded-2xl border backdrop-blur-md shadow-lg pointer-events-none sm:pointer-events-auto sm:cursor-help group",
                    getIndexColor(index)
                )}
                title={t('airQuality.station', { name: stationName })}
                style={{ top: 'calc(1.25rem + (var(--safe-area-inset-top, 0px)))', right: 'calc(4.5rem + (var(--safe-area-inset-right, 0px)))' }}
            >
                <Wind size={18} />
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-70 leading-none mb-0.5">
                        {t('airQuality.title')}
                    </span>
                    <span className="text-xs font-black leading-none">
                        {index ? t(`airQuality.indices.${index}`) : t('airQuality.unknown')}
                    </span>
                </div>

                {/* Hover Details for Desktop */}
                <div className="absolute top-full right-0 mt-2 p-2 bg-black/80 border border-white/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap hidden sm:block">
                    <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-tight">
                        {stationName}
                    </p>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
