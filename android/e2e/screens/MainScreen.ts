import { byId } from '../support/app.js';

/** The app's main screen: the toolbar actions around the WebView, and the offline panel. */
class MainScreen {
    watchButton(ticker: string) {
        return $(`~Watch ${ticker} for new filings`);
    }

    watchingButton(ticker: string) {
        return $(`~Watching ${ticker} (tap to stop)`);
    }

    /** Any Watch/Watching star (it only exists on a company's results page). */
    get anyWatchButton() {
        return $('android=new UiSelector().descriptionMatches("Watch(ing)? [A-Z0-9.\\\\-]+ .*")');
    }

    get watchlistButton() {
        return $('~Watchlist');
    }

    get offlineTitle() {
        return $(byId('errorTitle'));
    }

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
