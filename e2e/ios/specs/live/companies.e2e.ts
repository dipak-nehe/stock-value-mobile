import { expect } from '@wdio/globals';
import MainScreen from '../../screens/MainScreen.js';
import WebAnalysis from '../../../shared/webpages/WebAnalysisPage.js';
import WebCompanies from '../../../shared/webpages/WebCompaniesPage.js';
import { checkWebPage } from '../../support/a11y.js';
import { inWebView, launchApp, resetApp } from '../../support/app.js';
import { screenshot } from '../../support/report.js';

/**
 * The web app's All companies page inside the iOS app (live site): it opens from the header, loads the list of every
 * listed company (about 10,000), searches it, and a company opens its analysis inside the app.
 */
describe('All companies in the app (live site)', () => {
    before(async () => {
        await resetApp();
        await launchApp();
    });

    it('opens the All companies page inside the app from the header, with the full list', async () => {
        await inWebView(async () => {
            await WebAnalysis.waitUntilReady();
            await expect(WebAnalysis.companiesLink).toHaveText('US companies');
            await WebAnalysis.companiesLink.click();
        });
        // A new page: look up its context again.
        await inWebView(async () => {
            await expect(browser).toHaveUrl(expect.stringContaining('/companies.html'), { wait: 30_000 });
            await expect(WebCompanies.count).toHaveText(expect.stringMatching(/^Showing 100 of \d{1,2},\d{3} companies$/), { wait: 60_000 });
        }, { retries: 1 });
        await expect(MainScreen.pageArea).toBeDisplayed(); // still in the app, not the browser
        await screenshot('All companies in the app');
    });

    it('finds a company by name and opens its analysis in the app', async () => {
        await inWebView(async () => {
            await WebCompanies.search.setValue('coca cola');
            await expect(WebCompanies.rows[0]).toHaveText(expect.stringContaining('COCA COLA CO'), { wait: 30_000 });
            await WebCompanies.rows[0].$('a').click();
        });
        await inWebView(async () => {
            await expect(browser).toHaveUrl(expect.stringContaining('/stock/KO'), { wait: 30_000 });
            await expect(WebAnalysis.companyName).toHaveText('COCA COLA CO (KO)', { wait: 90_000 });
        }, { retries: 1 });
        await expect(MainScreen.pageArea).toBeDisplayed();
        await screenshot('Coca-Cola from All companies');
    });

    it('the All companies page passes axe-core inside the app', async () => {
        await resetApp();
        await launchApp({ open: 'https://www.equitymoat.com/companies.html?q=coca' });
        const violations = await inWebView(async () => {
            await expect(WebCompanies.rows[0]).toBeDisplayed({ wait: 60_000 });
            return checkWebPage('live All companies page');
        }, { retries: 1 });
        expect(violations).toEqual([]);
    });
});
