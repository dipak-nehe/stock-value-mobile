import { expect } from '@wdio/globals';
import MainScreen from '../../screens/MainScreen.js';
import { MockSite } from '../../support/mockSite.js';
import { inWebView, launchApp, removeReverse, resetApp, reversePort } from '../../support/app.js';

describe('Browsing the web app inside the app', () => {
    const site = new MockSite(8765);

    before(async () => {
        await site.start();
        reversePort(site.port);
        await resetApp();
        await launchApp({ site: site.url });
    });

    after(async () => {
        removeReverse(site.port);
        await site.stop();
    });

    it('shows the site in the WebView with the Watchlist action and no Watch star on the start page', async () => {
        await expect(MainScreen.pageArea).toBeDisplayed();
        await inWebView(async () => {
            await expect($('#title')).toHaveText('Home');
        });
        await expect(MainScreen.watchlistButton).toBeDisplayed();
        await expect(MainScreen.anyWatchButton).not.toBeExisting();
    });

    it('identifies itself to the site as the Android app', async () => {
        const ua = await inWebView(() => browser.execute(() => navigator.userAgent));
        expect(ua).toContain('StockValueAndroid/');
    });

    it('keeps links within the site in the app, and Back returns to the previous page', async () => {
        await inWebView(async () => {
            await $('#internal').click(); // a real tap through chromedriver, so Back history is kept
            await expect($('#title')).toHaveText('Next');
        });
        await driver.back();
        await inWebView(async () => {
            await expect($('#title')).toHaveText('Home');
        });
        await expect(MainScreen.pageArea).toBeDisplayed(); // still in the app
    });
});
