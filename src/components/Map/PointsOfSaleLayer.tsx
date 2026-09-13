import React, { useMemo } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import type { FeatureCollection } from 'geojson';
import type { SymbolLayerSpecification } from 'maplibre-gl';
import { useTheme } from 'next-themes';
import { usePointsOfSale } from '../../hooks/data/usePointsOfSale';
import { pointsOfSaleIcons, MAP_SOURCES } from '../../config/mapLayers';
import { EMPTY_FEATURE_COLLECTION } from '../../lib/geojson';

interface PointsOfSaleLayerProps {
    mapLoaded: boolean;
}


export const PointsOfSaleLayer: React.FC<PointsOfSaleLayerProps> = React.memo(({ mapLoaded }) => {
    const { data: posList } = usePointsOfSale();
    const { resolvedTheme } = useTheme();
    const textColor = resolvedTheme === 'dark' ? '#94a3b8' : '#64748b';
    const haloColor = resolvedTheme === 'dark' ? '#0f172a' : '#ffffff';

    const geoJsonData = useMemo<FeatureCollection>(() => {
        if (!posList || posList.length === 0) return EMPTY_FEATURE_COLLECTION;

        return {
            type: 'FeatureCollection',
            features: posList.map((pos) => ({
                type: 'Feature',
                id: pos.id,
                geometry: {
                    type: 'Point',
                    coordinates: [pos.lon, pos.lat]
                },
                properties: {
                    id: pos.id,
                    type: pos.type,
                    name: pos.name,
                    address: pos.address,
                    payMethods: pos.payMethods,
                    services: pos.services
                }
            }))
        };
    }, [posList]);

    const iconLayerWithTheme = useMemo(() => ({
        ...pointsOfSaleIcons,
        paint: {
            ...pointsOfSaleIcons.paint,
            'text-color': textColor,
            'text-halo-color': haloColor
        }
    }), [textColor, haloColor]);

    if (!mapLoaded) return null;

    return (
        <Source
            id={MAP_SOURCES.POINTS_OF_SALE}
            type="geojson"
            data={geoJsonData}
        >
            <Layer {...(iconLayerWithTheme as SymbolLayerSpecification)} />
        </Source>
    );
});

PointsOfSaleLayer.displayName = 'PointsOfSaleLayer';

