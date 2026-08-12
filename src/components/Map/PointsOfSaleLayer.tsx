import React, { useMemo } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import type { FeatureCollection } from 'geojson';
import type { SymbolLayerSpecification } from 'maplibre-gl';
import { useTheme } from 'next-themes';
import { usePointsOfSale } from '../../hooks/data/usePointsOfSale';

interface PointsOfSaleLayerProps {
    mapLoaded: boolean;
}

const EMPTY_GEOJSON: FeatureCollection = {
    type: 'FeatureCollection',
    features: []
};

const posPointIconLayer: SymbolLayerSpecification = {
    id: 'pos-point',
    type: 'symbol',
    source: 'points-of-sale-source',
    minzoom: 16,
    layout: {
        'icon-image': [
            'match',
            ['get', 'type'],
            'ticketMachine', 'pos-machine-icon',
            'informationCenter', 'pos-info-icon',
            'ticketOfficeMetro', 'pos-office-icon',
            'trainStation', 'pos-office-icon',
            'carrierOffice', 'pos-office-icon',
            'pos-machine-icon'
        ],
        'icon-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            16, 0.35,
            18, 0.52
        ],
        'icon-allow-overlap': false,
        'text-field': ['step', ['zoom'], '', 17.5, ['get', 'name']],
        'text-font': ['Montserrat Medium', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 17.5, 9.5, 19, 11],
        'text-offset': [0, 2.2],
        'text-anchor': 'top',
        'text-max-width': 7,
        'text-letter-spacing': 0.1,
        'text-optional': true,
        'symbol-sort-key': 100
    },
    paint: {
        'icon-opacity': 0.9,
        'text-color': '#94a3b8',
        'text-halo-color': '#0f172a',
        'text-halo-width': 1.5
    }
};

export const PointsOfSaleLayer: React.FC<PointsOfSaleLayerProps> = React.memo(({ mapLoaded }) => {
    const { data: posList } = usePointsOfSale();
    const { resolvedTheme } = useTheme();
    const textColor = resolvedTheme === 'dark' ? '#94a3b8' : '#64748b';
    const haloColor = resolvedTheme === 'dark' ? '#0f172a' : '#ffffff';

    const geoJsonData = useMemo<FeatureCollection>(() => {
        if (!posList || posList.length === 0) return EMPTY_GEOJSON;

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
        ...posPointIconLayer,
        paint: {
            ...posPointIconLayer.paint,
            'text-color': textColor,
            'text-halo-color': haloColor
        }
    }), [textColor, haloColor]);

    if (!mapLoaded) return null;

    return (
        <Source
            id="points-of-sale-source"
            type="geojson"
            data={geoJsonData}
        >
            <Layer {...(iconLayerWithTheme as SymbolLayerSpecification)} />
        </Source>
    );
});

PointsOfSaleLayer.displayName = 'PointsOfSaleLayer';

