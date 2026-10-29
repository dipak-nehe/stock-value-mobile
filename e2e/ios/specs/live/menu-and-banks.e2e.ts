import { expect } from '@wdio/globals';
import MainScreen from '../../screens/MainScreen.js';
import WebAnalysis from '../../../shared/webpages/WebAnalysisPage.js';
import { inWebView, launchApp, resetApp } from '../../support/app.js';
import { screenshot } from '../../support/report.js';

const SITE = 'https://www.equitymoat.com';
const MENU = ['Stocks', 'Compare', 'S&P 500', 'All companies', 'EU companies', 'Funds & ETFs', 'My portfolio'];

/**
 * The web app's main menu and a bank's valuation inside the iOS app (live site). The menu reads in task order with
 * the page you're on marked, and Compare opens from it inside the app. A bank (JPM) is valued on book value and return
 * on equity (its free cash flow mixes in deposits and loans), with an earnings yield at the entered price.
 */
describe('Main menu and a bank valuation in the app (live site)', () => {
    before(async () => {
        await resetApp();
        await launchApp();
    });

    it('shows the main menu in task order, with Stocks marked as the current page', async () => {
        const menu = await inWebView(async () => {
            await WebAnalysis.waitUntilReady();
            return WebAnalysis.menu();
        }, { retries: 1 });
        expect(menu).toEqual({ links: MENU, current: 'Stocks' });
        await screenshot('Main menu in the app');
    });

    it('Compare in the menu opens the compare page inside the app', async () => {
        await inWebView(async () => {
            await WebAnalysis.compareMenuLink.click();
        });
        // A new page: look up its context again.
        await inWebView(async () => {
            await expect(browser).toHaveUrl(expect.stringContaining('/compare.html'), { wait: 30_000 });
            expect((await WebAnalysis.menu()).current).toBe('Compare');
        }, { retries: 1 });
        await expect(MainScreen.pageArea).toBeDisplayed(); // still in the app, not the browser
        await screenshot('Compare from the menu');
    });

    it('values a bank (JPM) on book value and return on equity, with its earnings yield at a price', async () => {
        await resetApp();
        await launchApp({ open: `${SITE}/?t=JPM&p=331.58#value` });
        await inWebView(async () => {
            await expect(WebAnalysis.valueTiles).toHaveText(
                expect.stringMatching(/Book value \$[\d.]+\/share × \(return on equity [\d.]+% − growth [\d.]+%\)/), { wait: 90_000 });
            await expect(WebAnalysis.priceTiles).toHaveText(expect.stringMatching(/Latest earnings \$[\d.]+ a share ÷ price/));
        }, { retries: 1 });
        await screenshot('JPM valued as a bank');
    });
});
