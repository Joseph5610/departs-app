import { BasePage } from './BasePage';
import { Locator } from '@playwright/test';

export class MapPage extends BasePage {
    readonly mapControls: Locator = this.page.getByTestId('map-controls');
    readonly detailPanel: Locator = this.page.getByTestId('detail-panel');

    /** The floor shown on station floor plans, and the buttons stepping to the next one. */
    readonly floorLevel: Locator = this.page.getByTestId('floor-level');
    readonly floorUp: Locator = this.page.getByTestId('floor-up');
    readonly floorDown: Locator = this.page.getByTestId('floor-down');

    async isMapVisible() {
        // MapLibre canvas is usually nested in the MapGL container or we check for controls
        return await this.mapControls.isVisible();
    }

    async openSettings() {
        await this.page.getByTestId('map-settings-btn').click();
    }

    async openAlerts() {
        await this.page.getByTestId('map-alerts-btn').click();
    }

    async closeDetailPanel() {
        // Sheet content from shadcn usually has a close button or we can click outside/on close trigger
        // For now we assume there's a close action or we can find it by label
        await this.page.getByLabel('Close').first().click();
    }
}
