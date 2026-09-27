import { expect } from '@wdio/globals';
import MainScreen from '../../screens/MainScreen.js';
import MockPage from '../../webpages/MockPage.js';
import { MockSite } from '../../support/mockSite.js';
import { inWebView, launchApp, resetApp } from '../../support/app.js';

describe('Browsing the web app inside the app', () => {
    const site = new MockSite(8765);

    before(async () => {
        await site.start();
        await resetApp();
        await launchApp({ site: site.url });
    });

    after(async () => {
        await site.stop();
    });

    it('shows the site in the web view with the Watchlist button and no Watch star on the start page', async () => {
        await expect(MainScreen.pageArea).toBeDisplayed({ wait: 30_000 });
        await inWebView(async () => {
            await expect(MockPage.title).toHaveText('Home');
        });
        await expect(MainScreen.watchlistButton).toBeDisplayed();
        await expect(MainScreen.anyWatchButton).not.toBeExisting();
        await expect(MainScreen.backButton).not.toBeExisting(); // no history yet
    });

    it('identifies itself to the site as the iOS app', async () => {
        const ua = await inWebView(() => browser.execute(() => navigator.userAgent));
        expect(ua).toContain('StockValueiOS/');
    });

    it('keeps links within the site in the app, and Back returns to the previous page', async () => {
        await inWebView(async () => {
            await MockPage.nextPageLink.click();
        });
        await inWebView(async () => {
            await expect(MockPage.title).toHaveText('Next');
        }, { retries: 1 });
        await MainScreen.backButton.click();
        await inWebView(async () => {
            await expect(MockPage.title).toHaveText('Home');
        }, { retries: 1 });
        await expect(MainScreen.pageArea).toBeDisplayed(); // still in the app
    });
});
