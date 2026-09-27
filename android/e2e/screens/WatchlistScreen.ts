import { byId, byText, byTextContains } from '../support/app.js';

/** The native Watchlist screen. */
class WatchlistScreen {
    get checkNowButton() {
        return $(byId('checkNow'));
    }

    get emptyMessage() {
        return $(byId('empty'));
    }

    row(companyLine: string) {
        return $(byText(companyLine));
    }

    detail(text: string) {
        return $(byTextContains(text));
    }

    removeButton(ticker: string) {
        return $(`~Stop watching ${ticker}`);
    }

    /** The screen re-reads the list when it comes back to the front; reopen to see a background update. */
    async waitForDetail(text: string, timeout = 60_000): Promise<void> {
        await browser.waitUntil(
            async () => {
                if (await this.detail(text).isDisplayed()) return true;
                await driver.back();
                await $('~Watchlist').click();
                return false;
            },
            { timeout, interval: 3_000, timeoutMsg: `Watchlist never showed "${text}"` },
        );
    }
}

export default new WatchlistScreen();
