import { memo, useMemo } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import { useTheme } from 'next-themes';
import { useIndoorMap } from '@/hooks/derived/useIndoorMap';
import { useIndoorView } from '@/hooks/features/useIndoorView';
import { indoorLevelToken } from '@/domain/indoor';
import { createIndoorLayers, MAP_SOURCES } from '@/config/mapLayers';
import { INDOOR_MAP } from '@/config/constants';

interface IndoorLayerProps {
    mapLoaded: boolean;
}

/** The floor plan of the station in view from OpenStreetMap, one floor at a time; `MapControls` holds the floor switcher. */
export const IndoorLayer = memo(({ mapLoaded }: IndoorLayerProps) => {
    const { station, data, level } = useIndoorMap(useIndoorView());
    const hasPlan = station !== null;

    const { resolvedTheme } = useTheme();
    const theme = resolvedTheme === 'light' ? 'light' : 'dark';
    const layers = useMemo(
        () => createIndoorLayers(theme, indoorLevelToken(level), INDOOR_MAP.MIN_ZOOM, hasPlan),
        [theme, level, hasPlan],
    );

    if (!mapLoaded) return null;

    return (
        <>
            <Layer {...layers[0]} />
            <Source id={MAP_SOURCES.INDOOR} type="geojson" data={data}>
                {layers.slice(1).map(layer => <Layer key={layer.id} {...layer} />)}
            </Source>
        </>
    );
});

IndoorLayer.displayName = 'IndoorLayer';
