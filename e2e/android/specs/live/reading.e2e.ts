import { expect } from '@wdio/globals';
import WebAnalysis from '../../../shared/webpages/WebAnalysisPage.js';
import { inWebView, launchApp, resetApp } from '../../support/app.js';
import { screenshot } from '../../support/report.js';

const SITE = 'https://www.equitymoat.com';

/**
 * Reading and keeping a result inside the Android app (live site): the link to the latest annual report and the
 * dividend record show as on the website, and Print is left out, because the app's web view can't print.
 */
describe('Reading a result in the app (live site)', () => {
    before(async () => {
        await resetApp();
        await launchApp({ open: `${SITE}/?t=KO` });
    });

    it('shows the annual report link and the dividend record, but no Print button', async () => {
        await inWebView(async () => {
            await expect(WebAnalysis.companyName).toHaveText('COCA COLA CO (KO)', { wait: 90_000 });
            await expect(WebAnalysis.annualLink).toHaveText(expect.stringMatching(/^Annual report \(10-K, filed /));
            await expect(WebAnalysis.annualLink).toHaveAttribute('href', expect.stringContaining('https://www.sec.gov/Archives/edgar/data/21344/'));
            await expect(WebAnalysis.dividends).toHaveText(expect.stringContaining('Dividend record'));
            await expect(WebAnalysis.printButton).not.toBeDisplayed();
        }, { retries: 1 });
        await screenshot('KO results header in the app');
    });
});
