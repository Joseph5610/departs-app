import { memo, useMemo } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import { useTheme } from 'next-themes';
import { usePlatforms } from '@/hooks/data/usePlatforms';
import { useIndoorMap } from '@/hooks/derived/useIndoorMap';
import { useIndoorView } from '@/hooks/features/useIndoorView';
import { usePreferencesStore } from '@/state/preferencesStore';
import { createPlatformLayers, MAP_LAYERS, MAP_SOURCES } from '@/config/mapLayers';
import { INDOOR_MAP } from '@/config/constants';
import { EMPTY_FEATURE_COLLECTION } from '@/lib/geojson';

interface PlatformsLayerProps {
    mapLoaded: boolean;
}

/** The selected city's tram and train platforms on street level, from OpenStreetMap, drawn when zoomed in close and no plan shows another floor. */
export const PlatformsLayer = memo(({ mapLoaded }: PlatformsLayerProps) => {
    const city = usePreferencesStore(s => s.selectedCity);
    const view = useIndoorView();
    const { station, level } = useIndoorMap(view);
    const { data } = usePlatforms(city, view !== null);
    // Street-level platforms belong to floor 0; under a plan showing another floor they would mix with its platforms.
    const isVisible = station === null || level === INDOOR_MAP.DEFAULT_LEVEL;

    const { resolvedTheme } = useTheme();
    const theme = resolvedTheme === 'light' ? 'light' : 'dark';
    const layers = useMemo(() => createPlatformLayers(theme, INDOOR_MAP.MIN_ZOOM, isVisible), [theme, isVisible]);

    if (!mapLoaded) return null;

    return (
        <Source id={MAP_SOURCES.PLATFORMS} type="geojson" data={data ?? EMPTY_FEATURE_COLLECTION}>
            {layers.map(layer => <Layer key={layer.id} {...layer} beforeId={MAP_LAYERS.INDOOR_FLOOR} />)}
        </Source>
    );
});

PlatformsLayer.displayName = 'PlatformsLayer';
