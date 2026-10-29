import { distanceMeters } from '@shared/geo';

export const DEG = Math.PI / 180;

/** A real position: present and not the feeds' `[0, 0]` placeholder. */
export const hasPosition = (coords: readonly number[] | null | undefined): coords is [number, number] =>
    !!coords && (coords[0] !== 0 || coords[1] !== 0);

/** Great-circle distance in metres between two `[lon, lat]` positions. */
export const calculateDistance = ([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]): number =>
    distanceMeters(lat1, lon1, lat2, lon2);
