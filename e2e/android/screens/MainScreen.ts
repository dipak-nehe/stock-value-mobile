import { byId } from '../support/app.js';
import { say, type Lang } from '../../shared/lang.js';

/**
 * The app's main (native) screen: the toolbar actions around the WebView, and the offline panel.
 *
 * Locator order for native screens: accessibility id (`~`, what TalkBack reads) → resource-id (`byId`) →
 * UiSelector text → never XPath. Controls are found by accessibility id in the screen's language; content by
 * resource-id. `new MainScreen('es')` gives the Spanish names; the default export is English.
 */
export class MainScreen {
    constructor(readonly lang: Lang = 'en') {}

    watchButton(ticker: string) {
        return $(`~${say(this.lang, `Watch ${ticker} for new filings`, `Seguir las presentaciones de ${ticker}`)}`);
    }

    watchingButton(ticker: string) {
        return $(`~${say(this.lang, `Watching ${ticker} (tap to stop)`, `Siguiendo ${ticker} (toca para dejar de seguir)`)}`);
    }

    /** Any Watch/Watching star, English names (it only exists on a company's results page). */
    get anyWatchButton() {
        return $('android=new UiSelector().descriptionMatches("Watch(ing)? [A-Z0-9.\\\\-]+ .*")');
    }

    get watchlistButton() {
        return $(`~${say(this.lang, 'Watchlist', 'Seguimiento')}`);
    }

    get offlineTitle() {
        return $(byId('errorTitle'));
    }

    /** Buttons show their text in capitals: compare its text with `{ ignoreCase: true }`. */
    get retryButton() {
        return $(byId('retry'));
    }

    /**
     * The area holding the web page. (The WebView's own accessibility node is replaced as the page renders,
     * so UiAutomator2 reports it as stale; its container is stable.)
     */
    get pageArea() {
        return $(byId('refresh'));
    }

    async openWatchlist(): Promise<void> {
        await this.watchlistButton.click();
    }
}

export default new MainScreen();
