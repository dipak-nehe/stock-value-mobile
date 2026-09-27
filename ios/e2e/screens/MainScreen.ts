import { allowNotificationsIfAsked, byId, byLabel } from '../support/app.js';
import { say, type Lang } from './lang.js';

/**
 * The app's main (native) screen: the toolbar around the web page, the offline panel and the short messages.
 *
 * Locator order for native screens: the label VoiceOver reads (`byLabel`) for controls, in the screen's language →
 * accessibility identifier (`~id`, set in Views.swift) for content and for buttons whose text we assert on →
 * class chain only for system parts → never XPath. `new MainScreen('es')` gives the Spanish names; the default
 * export is English.
 */
export class MainScreen {
    constructor(readonly lang: Lang = 'en') {}

    watchButton(ticker: string) {
        return $(byLabel(say(this.lang, `Watch ${ticker} for new filings`, `Seguir las presentaciones de ${ticker}`)));
    }

    watchingButton(ticker: string) {
        return $(byLabel(say(this.lang, `Watching ${ticker} (tap to stop)`, `Siguiendo ${ticker} (toca para dejar de seguir)`)));
    }

    /** The Watch/Watching star in either state, any language (it only exists on a company's results page). */
    get anyWatchButton() {
        return $('-ios predicate string:name IN {"watch-button", "watching-button"}');
    }

    /** Taps the empty star and answers iOS's notification question the first time. */
    async watch(ticker: string): Promise<void> {
        await this.watchButton(ticker).click();
        await allowNotificationsIfAsked();
    }

    get watchlistButton() {
        return $(byLabel(say(this.lang, 'Watchlist', 'Seguimiento')));
    }

    /** ‹ Back: only shown when the page has history. */
    get backButton() {
        return $(byLabel(say(this.lang, 'Back', 'Atrás')));
    }

    get offlineTitle() {
        return $(byId('offline-title'));
    }

    get retryButton() {
        return $(byId('retry-button'));
    }

    /** The short message under the toolbar, e.g. "Watching KO. You'll get a notification …". */
    get toast() {
        return $(byId('toast'));
    }

    /** The web page area (the WKWebView; its id is set in WebController.swift). */
    get pageArea() {
        return $(byId('web-view'));
    }

    async openWatchlist(): Promise<void> {
        await this.watchlistButton.click();
    }
}

export default new MainScreen();
