import type { Page } from '@playwright/test';

/** Hlavní nádraží, where the indoor fixture's plan lies. */
export const HLAVAK_CAMERA = { lat: 50.0833, lng: 14.4352 };

const STATION = 'U142S1';

const room = (level: number, offset: number) => ({
    type: 'Feature',
    geometry: {
        type: 'Polygon',
        coordinates: [[[14.4350 + offset, 50.0831], [14.4356 + offset, 50.0831], [14.4356 + offset, 50.0835], [14.4350 + offset, 50.0835], [14.4350 + offset, 50.0831]]],
    },
    properties: { k: 'corridor', lv: [level] },
});

/** Serves a floor plan of Hlavní nádraží on `levels` (0 and -1 by default) as `indoor/` on the static data CDN. */
export async function mockIndoor(page: Page, levels: number[] = [-1, 0]): Promise<void> {
    await page.route(/\/indoor\/index\.json(\?|$)/, route => route.fulfill({
        json: { version: 4, stations: { [STATION]: { name: 'Hlavní nádraží', levels, bbox: [14.4350, 50.0831, 14.4358, 50.0835], v: 'fixture1' } } },
    }));
    await page.route(new RegExp(`/indoor/${STATION}\\.json\\?v=fixture1$`), route => route.fulfill({
        json: { type: 'FeatureCollection', features: [room(0, 0), room(-1, 0.0002)] },
    }));
}

/** Opens the map at `zoom` over Hlavní nádraží, as if the user had left it there. */
export async function openMapAt(page: Page, zoom: number): Promise<void> {
    await page.addInitScript(({ lat, lng, zoom }) => {
        window.localStorage.setItem('departs-last-view', JSON.stringify({ state: { savedCamera: { lat, lng, zoom }, savedCameraAt: Date.now() }, version: 1 }));
    }, { ...HLAVAK_CAMERA, zoom });
}
