import { useEffect, useState } from 'react';
import type { Box } from '@/domain/cities';
import { useMapMetadataStore } from '@/state/mapMetadataStore';
import { INDOOR_MAP } from '@/config/constants';

/** What of the map a floor plan is shown in: the visible box, null zoomed out too far for plans. */
export type IndoorView = Box | null;

/** The map's visible box once zoomed in far enough for station floor plans, updated when the map stops moving. */
export const useIndoorView = (): IndoorView => {
    const mapRef = useMapMetadataStore(s => s.mapRef);
    const mapLoaded = useMapMetadataStore(s => s.mapLoaded);
    const [view, setView] = useState<IndoorView>(null);
    useEffect(() => {
        const map = mapRef.current?.getMap();
        if (!map) return;
        const update = () => {
            if (map.getZoom() < INDOOR_MAP.MIN_ZOOM) return setView(null);
            const bounds = map.getBounds();
            setView([bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]);
        };
        update();
        map.on('moveend', update);
        return () => { map.off('moveend', update); };
    }, [mapRef, mapLoaded]);
    return view;
};
