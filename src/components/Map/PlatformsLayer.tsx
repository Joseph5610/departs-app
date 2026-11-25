import { memo, useMemo } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import { useTheme } from 'next-themes';
import { usePlatforms } from '@/hooks/data/usePlatforms';
import { useIndoorView } from '@/hooks/features/useIndoorView';
import { usePreferencesStore } from '@/state/preferencesStore';
import { createPlatformLayers, MAP_LAYERS, MAP_SOURCES } from '@/config/mapLayers';
import { INDOOR_MAP } from '@/config/constants';
import { EMPTY_FEATURE_COLLECTION } from '@/lib/geojson';

interface PlatformsLayerProps {
    mapLoaded: boolean;
}

/** The selected city's tram and train platforms on street level, from OpenStreetMap, drawn when zoomed in close. */
export const PlatformsLayer = memo(({ mapLoaded }: PlatformsLayerProps) => {
    const city = usePreferencesStore(s => s.selectedCity);
    const isCloseEnough = useIndoorView() !== null;
    const { data } = usePlatforms(city, isCloseEnough);

    const { resolvedTheme } = useTheme();
    const theme = resolvedTheme === 'light' ? 'light' : 'dark';
    const layers = useMemo(() => createPlatformLayers(theme, INDOOR_MAP.MIN_ZOOM), [theme]);

    if (!mapLoaded) return null;

    return (
        <Source id={MAP_SOURCES.PLATFORMS} type="geojson" data={data ?? EMPTY_FEATURE_COLLECTION}>
            {layers.map(layer => <Layer key={layer.id} {...layer} beforeId={MAP_LAYERS.INDOOR_FLOOR} />)}
        </Source>
    );
});

PlatformsLayer.displayName = 'PlatformsLayer';
