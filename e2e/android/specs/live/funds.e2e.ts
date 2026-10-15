import { expect } from '@wdio/globals';
import MainScreen from '../../screens/MainScreen.js';
import WebAnalysis from '../../../shared/webpages/WebAnalysisPage.js';
import WebFunds from '../../../shared/webpages/WebFundsPage.js';
import { checkWebPage } from '../../support/a11y.js';
import { inWebView, launchApp, resetApp } from '../../support/app.js';
import { screenshot } from '../../support/report.js';

/**
 * The web app's Funds page inside the Android app (live site, real SEC data): it opens in the app from the header,
 * shows a fund's costs, returns and top 10 holdings from its SEC reports, and compares two funds.
 */
describe('Mutual funds & ETFs in the app (live site)', () => {
    before(async () => {
        await resetApp();
        await launchApp();
    });

    it('opens the Funds page inside the app from the header', async () => {
        await inWebView(async () => {
            await WebAnalysis.waitUntilReady();
            await WebAnalysis.fundsLink.click();
        });
        // A new page: reconnect instead of keeping chromedriver on the old one (the CI WebView drops it).
        await inWebView(async () => {
            await expect(browser).toHaveUrl(expect.stringContaining('/funds.html'), { wait: 30_000 });
            await expect(WebFunds.tickerBox).toBeDisplayed();
        }, { retries: 1 });
        await expect(MainScreen.pageArea).toBeDisplayed(); // still in the app, not the browser
        await screenshot('Funds page in the app');
    });

    it('shows a fund\'s costs, returns and top 10 holdings from real SEC filings', async () => {
        await inWebView(async () => {
            await WebFunds.add('VOO');
            await expect(WebFunds.result).toBeDisplayed({ wait: 90_000 });
            await expect(WebFunds.columns).toBeElementsArrayOfSize(1);
            await expect(await WebFunds.cell('expenseRatio', 0)).toHaveText(expect.stringMatching(/^0\.\d\d%/));
            await expect(await WebFunds.cell('ret10', 0)).toHaveText(expect.stringMatching(/%/));
            await expect(WebFunds.topCards[0]).toHaveText(expect.stringContaining('NVIDIA'));
            await expect(browser).toHaveUrl(expect.stringContaining('f=VOO'));
        });
        await screenshot('VOO in the app');
    });

    it('compares a second fund, with how much they overlap', async () => {
        await inWebView(async () => {
            await WebFunds.add('VTI');
            await expect(WebFunds.columns).toBeElementsArrayOfSize(2, { wait: 90_000 });
            await expect(WebFunds.overlapPairs[0]).toHaveText(expect.stringContaining('VOO & VTI'), { wait: 30_000 });
        });
        await screenshot('VOO and VTI compared');
    });

    it('the Funds page passes axe-core inside the app', async () => {
        const violations = await inWebView(() => checkWebPage('live Funds page'));
        expect(violations).toEqual([]);
    });
});
