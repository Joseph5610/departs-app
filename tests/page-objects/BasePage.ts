import { Page, Locator } from '@playwright/test';

export class BasePage {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    async goto(path: string = '/') {
        await this.page.addInitScript(() => {
            window.localStorage.setItem('departs-preferences', JSON.stringify({ state: { hasSeenWelcome: true }, version: 0 }));
        });
        await this.page.goto(path);
    }

    async dismissInitialModals() {
        // Dismiss WelcomeModal if it appears
        const welcomeCta = this.page.getByTestId('welcome-cta');
        if (await welcomeCta.isVisible({ timeout: 2000 }).catch(() => false)) {
            await welcomeCta.click();
        }
    }

    async waitForLoadingFinished() {
        // Example: wait for a global loader to disappear or map to load
        // This is a placeholder for project-specific loading logic
    }

    getToast(message: string): Locator {
        return this.page.getByText(message);
    }
}
