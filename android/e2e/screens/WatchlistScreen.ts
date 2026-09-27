import { byId, byText, byTextContains } from '../support/app.js';
import { say, type Lang } from './lang.js';

/** The native Watchlist screen. `new WatchlistScreen('es')` gives the Spanish names; the default export is English. */
export class WatchlistScreen {
    constructor(readonly lang: Lang = 'en') {}

    /** Buttons show their text in capitals: compare its text with `{ ignoreCase: true }`. */
    get checkNowButton() {
        return $(byId('checkNow'));
    }

    /** The explanation at the top ("You'll get a notification when …"). */
    get intro() {
        return $(byId('intro'));
    }

    get emptyMessage() {
        return $(byId('empty'));
    }

    /** A company's row, by its first line, e.g. "COCA COLA CO (KO)". */
    row(companyLine: string) {
        return $(byText(companyLine));
    }

    /** A row's second line, e.g. "Latest report: 10-Q filed 2026-04-28". */
    detail(text: string) {
        return $(byTextContains(text));
    }

    removeButton(ticker: string) {
        return $(`~${say(this.lang, `Stop watching ${ticker}`, `Dejar de seguir ${ticker}`)}`);
    }

    /** The screen refreshes itself when a check finishes, so just wait for the text. */
    async waitForDetail(text: string, timeout = 60_000): Promise<void> {
        await this.detail(text).waitForDisplayed({ timeout, timeoutMsg: `Watchlist never showed "${text}"` });
    }
}

export default new WatchlistScreen();
