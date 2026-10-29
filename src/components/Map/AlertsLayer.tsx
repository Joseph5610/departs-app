import { useMemo, memo } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import type { SymbolLayerSpecification } from 'maplibre-gl';
import { useTheme } from 'next-themes';
import { useAlerts } from '@/hooks/data/useAlerts';
import { useCityConfig } from '@/hooks/data/useCities';
import { usePreferencesStore } from '@/state/preferencesStore';
import { alertMarkers, ALERT_MARKER, MAP_SOURCES } from '@/config/mapLayers';
import { alertMapPoints } from '@/domain/alerts';
import { EMPTY_FEATURE_COLLECTION } from '@/lib/geojson';
import { memoizeLast } from '@/lib/memoize';

const toPoints = memoizeLast(alertMapPoints);

interface AlertsLayerProps {
    mapLoaded: boolean;
}

/** The city's placed alerts (closures, moved stops) as markers; a tap opens the alert in the alerts list. */
export const AlertsLayer = memo(({ mapLoaded }: AlertsLayerProps) => {
    const { alerts } = useAlerts();
    const hasAlertLocations = Boolean(useCityConfig().hasAlertLocations);
    const showAlertsOnMap = usePreferencesStore(s => s.showAlertsOnMap);
    const { resolvedTheme } = useTheme();
    const label = ALERT_MARKER.LABEL[resolvedTheme === 'light' ? 'light' : 'dark'];

    const data = hasAlertLocations && showAlertsOnMap && alerts ? toPoints(alerts) : EMPTY_FEATURE_COLLECTION;

    const layer = useMemo<SymbolLayerSpecification>(() => ({
        ...alertMarkers,
        paint: { ...alertMarkers.paint, 'text-color': label.text, 'text-halo-color': label.halo },
    }), [label]);

    if (!mapLoaded) return null;

    return (
        <Source id={MAP_SOURCES.ALERTS} type="geojson" data={data}>
            <Layer {...layer} />
        </Source>
    );
});

AlertsLayer.displayName = 'AlertsLayer';
