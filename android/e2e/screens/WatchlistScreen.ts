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

    /** The screen refreshes itself when a check finishes, so just wait for the text. */
    async waitForDetail(text: string, timeout = 60_000): Promise<void> {
        await this.detail(text).waitForDisplayed({ timeout, timeoutMsg: `Watchlist never showed "${text}"` });
    }
}

export default new WatchlistScreen();
