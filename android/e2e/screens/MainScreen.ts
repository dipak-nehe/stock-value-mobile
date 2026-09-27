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

    get webView() {
        return $(byId('web'));
    }

    async openWatchlist(): Promise<void> {
        await this.watchlistButton.click();
    }
}

export default new MainScreen();
