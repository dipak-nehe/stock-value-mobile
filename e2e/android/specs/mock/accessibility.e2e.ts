import { expect } from '@wdio/globals';
import MainScreen from '../../screens/MainScreen.js';
import WatchlistScreen from '../../screens/WatchlistScreen.js';
import { checkNativeScreen, checkWebPage } from '../../support/a11y.js';
import { MockSite, type Report } from '../../../shared/mockSite.js';
import { inWebView, launchApp, removeReverse, resetApp, reversePort } from '../../support/app.js';
import { screenshot } from '../../support/report.js';

const Q2: Report = { form: '10-Q', date: '2026-04-28', accession: '0000021344-26-000010', url: 'https://www.sec.gov/q2.htm' };

/**
 * Every screen of the app: native controls need a screen-reader label and a 48dp touch target;
 * the page inside the WebView is checked with axe-core (WCAG 2.1 A/AA). Findings are attached to the Allure report.
 */
describe('Accessibility', () => {
    const site = new MockSite(8765);

    before(async () => {
        site.report = Q2;
        await site.start();
        reversePort(site.port);
        await resetApp();
        await launchApp({ site: site.url });
    });

    after(async () => {
        removeReverse(site.port);
        await site.stop();
    });

    it('start screen: native controls are labelled and large enough', async () => {
        await expect(MainScreen.watchlistButton).toBeDisplayed();
        await screenshot('start screen');
        expect(await checkNativeScreen('start screen')).toEqual([]);
    });

    it('the page inside the WebView passes axe-core', async () => {
        const violations = await inWebView(() => checkWebPage('mock start page'));
        expect(violations).toEqual([]);
    });

    it('results screen with the Watch star', async () => {
        await launchApp({ site: site.url, open: `${site.url}?t=KO` });
        await expect(MainScreen.watchButton('KO')).toBeDisplayed();
        expect(await checkNativeScreen('results screen')).toEqual([]);
    });

    it('Watchlist with a company', async () => {
        await MainScreen.watchButton('KO').click();
        await MainScreen.openWatchlist();
        await WatchlistScreen.waitForDetail('Latest report: 10-Q filed 2026-04-28');
        await screenshot('Watchlist with KO');
        expect(await checkNativeScreen('Watchlist with a company')).toEqual([]);
    });

    it('empty Watchlist', async () => {
        await WatchlistScreen.removeButton('KO').click();
        await expect(WatchlistScreen.emptyMessage).toBeDisplayed();
        expect(await checkNativeScreen('empty Watchlist')).toEqual([]);
    });

    it('offline screen', async () => {
        await launchApp({ site: 'http://localhost:8767/' }); // nothing listens there
        await expect(MainScreen.offlineTitle).toBeDisplayed({ wait: 30_000 });
        expect(await checkNativeScreen('offline screen')).toEqual([]);
    });
});
