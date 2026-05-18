import { BasePage } from './BasePage';
import { Locator } from '@playwright/test';

export class AlertsPage extends BasePage {
    readonly container: Locator = this.page.getByTestId('alerts-modal-content');
    readonly searchInput: Locator = this.container.locator('input[type="text"]');
    readonly incidentsTab: Locator = this.container.getByRole('tab', { name: /Incidents|Události/i });
    readonly exclusionsTab: Locator = this.container.getByRole('tab', { name: /Exclusions|Výluky/i });

    readonly emptyStateMessage: Locator = this.container.getByText(new RegExp("Nejsou aktivn\u00ed \u017e\u00e1dn\u00e9 ud\u00e1losti|No active alerts", "i"));
    readonly closeButton: Locator = this.container.getByRole('button', { name: 'Close' });

    async searchAlert(query: string) {
        await this.searchInput.fill(query);
    }

    async switchTab(tab: 'incidents' | 'exclusions') {
        if (tab === 'incidents') {
            await this.incidentsTab.click();
        } else {
            await this.exclusionsTab.click();
        }
    }

    getAlertCardCount() {
        // We can look for cards within the scroll area
        // GenericAlertCard contains h3 titles inside an 'article' or specific structure.
        return this.container.locator('[role="article"]').count();
    }

    async close() {
        await this.closeButton.click();
    }
}
