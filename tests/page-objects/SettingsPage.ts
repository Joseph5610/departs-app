import { BasePage } from './BasePage';
import { Locator } from '@playwright/test';

export class SettingsPage extends BasePage {
    readonly container: Locator = this.page.getByTestId('settings-modal-content');

    // Row buttons (which toggle the switches)
    readonly showVehiclesRow: Locator = this.container.locator('button').filter({ hasText: /Live vehicle locations|Poloha vozidel/i });
    readonly showStopsRow: Locator = this.container.locator('button').filter({ hasText: /Show stops|Zobrazit zastávky/i });
    
    // Switches (for state verification)
    readonly showVehiclesSwitch: Locator = this.container.locator('button[role="switch"]').first();
    readonly showStopsSwitch: Locator = this.container.locator('button[role="switch"]').nth(1);
    
    // Close Button
    readonly closeButton: Locator = this.container.getByRole('button', { name: 'Close' });
    
    // Vehicle Types
    async toggleVehicleType(id: string) {
        await this.container.getByTestId(`vehicle-type-${id}`).click();
    }

    async changeLanguage(lang: 'en' | 'cs') {
        const langRegex = lang === 'en' ? /English|Angličtina/i : /Čeština|Czech/i;
        const btn = this.container.locator('button').filter({ hasText: langRegex });
        await btn.click();
    }

    async close() {
        try {
            await this.page.keyboard.press('Escape');
            await this.container.waitFor({ state: 'hidden', timeout: 2000 });
        } catch {
            const closeBtn = this.container.locator('button:has(svg.lucide-x), button[name="Close"]', { hasText: 'Close' }).first();
            if (await closeBtn.isVisible()) {
                await closeBtn.click({ force: true });
            } else {
                await this.closeButton.click({ force: true });
            }
        }
    }
}
