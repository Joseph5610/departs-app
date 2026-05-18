import { BasePage } from './BasePage';
import { Locator } from '@playwright/test';

export class SearchPage extends BasePage {
    readonly searchInput: Locator = this.page.getByTestId('search-input');

    async search(query: string) {
        await this.searchInput.fill(query);
    }

    async selectStop(name: string) {
        await this.page.getByTestId(`search-item-stop-${name}`).click();
    }

    getStopSearchItem(pattern: RegExp): Locator {
        return this.page.getByRole('button', { name: pattern }).first();
    }

    async selectStopByRegex(pattern: RegExp) {
        await this.getStopSearchItem(pattern).click();
    }

    async selectLine(line: string) {
        await this.page.getByTestId(`search-item-line-${line}`).click();
    }
}
