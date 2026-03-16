import { BasePage } from './BasePage';
import { Locator } from '@playwright/test';

export class AlertsPage extends BasePage {
    readonly container: Locator = this.page.getByTestId('alerts-modal-content');
    readonly searchInput: Locator = this.container.locator('input[type="text"]');
    readonly incidentsTab: Locator = this.container.getByRole('tab', { name: /Incidents|Události/i });
    readonly exclusionsTab: Locator = this.container.getByRole('tab', { name: /Exclusions|Výluky/i });

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
}
