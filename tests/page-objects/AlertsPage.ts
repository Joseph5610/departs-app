import { BasePage } from './BasePage';
import { Locator } from '@playwright/test';

export class AlertsPage extends BasePage {
    readonly container: Locator = this.page.getByTestId('alerts-modal-content');
    readonly searchInput: Locator = this.container.locator('input[type="text"]');
    readonly liveTab: Locator = this.container.getByRole('tab', { name: /All|Vše/i });
    readonly plannedTab: Locator = this.container.getByRole('tab', { name: /Incidents|Incidenty/i });

    readonly emptyStateMessage: Locator = this.container.getByText(new RegExp("Nejsou aktivn\u00ed \u017e\u00e1dn\u00e9 ud\u00e1losti|No active alerts|No alerts", "i"));
    readonly closeButton: Locator = this.container.getByRole('button', { name: 'Close' });

    async searchAlert(query: string) {
        await this.searchInput.fill(query);
    }

    async switchTab(tab: 'live' | 'planned') {
        if (tab === 'live') {
            await this.liveTab.click();
        } else {
            await this.plannedTab.click();
        }
    }

    getAlertCardCount() {
        // We can look for cards within the scroll area
        // GenericAlertCard contains h3 titles inside an 'article' or specific structure.
        return this.container.locator('[role="article"]').count();
    }

    async close() {
        try {
            await this.page.keyboard.press('Escape');
            await this.container.waitFor({ state: 'hidden', timeout: 2000 });
        } catch {
            await this.closeButton.click({ force: true });
        }
    }
}
