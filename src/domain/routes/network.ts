import type { NetworkLineCollection, RouteType } from '@/types';

export interface ColoredNetwork {
    lines: NetworkLineCollection;
    /** Every colour drawn, for building the dimmed palette. */
    colors: string[];
}

/** The network with each piece lacking its own colour painted in its mode's colour (the stop badges' tile colour). */
export function colorNetwork(network: NetworkLineCollection, modeColors: Readonly<Record<RouteType, string>>): ColoredNetwork {
    const colors = new Set<string>();
    const features = network.features.map(f => {
        const color = f.properties.route_color ?? modeColors[f.properties.route_type];
        colors.add(color);
        return f.properties.route_color ? f : { ...f, properties: { ...f.properties, route_color: color } };
    });
    return { lines: { ...network, features }, colors: [...colors] };
}
