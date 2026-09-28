import { expect } from '@wdio/globals';
import MainScreen from '../../screens/MainScreen.js';
import WebAnalysis, { WebAnalysisPage } from '../../../shared/webpages/WebAnalysisPage.js';
import { inWebView, launchApp, resetApp } from '../../support/app.js';
import { screenshot } from '../../support/report.js';

const LIVE = 'https://stock-value-analysis.vercel.app/';

/** Against the real site: proves the app works with the live web app and SEC data, not only with the mock. */
describe('Live site smoke test', () => {
    before(async () => {
        await resetApp();
        await launchApp(); // no override: https://stock-value-analysis.vercel.app
    });

    it('loads the live web app and analyses a company from real SEC data', async () => {
        // One switch into the page for the whole web flow.
        await inWebView(async () => {
            await expect(WebAnalysis.siteTitle).toHaveText(expect.stringContaining('10-Year Stock Value Analysis'), { wait: 60_000 });
            await WebAnalysis.waitUntilReady();
            await expect(WebAnalysis.analyzeButton).toBeDisabled(); // nothing typed yet: the site won't search for nothing
            await WebAnalysis.search('KO');
            await expect(WebAnalysis.companyName).toHaveText('COCA COLA CO (KO)', { wait: 90_000 });
            await expect(WebAnalysis.glance).toBeDisplayed();
        });
        await screenshot('live results for KO');
    });

    it('offers the Watch star for that company', async () => {
        await expect(MainScreen.watchButton('KO')).toBeDisplayed({ wait: 20_000 });
    });

    it('shows the web app in Spanish inside the app', async () => {
        await launchApp({ open: `${LIVE}?t=KO&lang=es` });
        const spanish = new WebAnalysisPage('es');
        await inWebView(async () => {
            await expect(spanish.analyzeButton).toHaveText('Analizar', { wait: 60_000 });
            await expect(spanish.companyName).toHaveText('COCA COLA CO (KO)', { wait: 90_000 });
            await expect(spanish.tab('flags')).toHaveText(expect.stringContaining('Señales'));
        }, { retries: 1 });
        await screenshot('live results in Spanish');
    });
});
