import { byId, byLabel, byLabelContains } from '../support/app.js';
import { say, type Lang } from './lang.js';

/** The native Watchlist screen. `new WatchlistScreen('es')` gives the Spanish names; the default export is English. */
export class WatchlistScreen {
    constructor(readonly lang: Lang = 'en') {}

    get checkNowButton() {
        return $(byId('check-now-button'));
    }

    /** The explanation at the top ("You'll get a notification when …"). */
    get intro() {
        return $(byId('watchlist-intro'));
    }

    get emptyMessage() {
        return $(byId('watchlist-empty'));
    }

    /** A company's row (a button that opens its analysis); its text is e.g. "COCA COLA CO (KO), Latest report: …". */
    row(ticker: string) {
        return $(byId(`row-${ticker}`));
    }

    /** Any text on the screen containing `text`, e.g. "Latest report: 10-Q filed 2026-04-28". */
    detail(text: string) {
        return $(byLabelContains(text));
    }

    removeButton(ticker: string) {
        return $(byLabel(say(this.lang, `Stop watching ${ticker}`, `Dejar de seguir ${ticker}`)));
    }

    /**
     * The navigation bar's system back button. Class chain: it's drawn by iOS, and its label (the previous screen's
     * title, or "Back") differs between iOS versions.
     */
    get closeButton() {
        return $('-ios class chain:**/XCUIElementTypeNavigationBar/XCUIElementTypeButton[1]');
    }

    /** The screen refreshes itself when a check finishes, so just wait for the text. */
    async waitForDetail(text: string, timeout = 60_000): Promise<void> {
        await this.detail(text).waitForDisplayed({ timeout, timeoutMsg: `Watchlist never showed "${text}"` });
    }
}

export default new WatchlistScreen();
