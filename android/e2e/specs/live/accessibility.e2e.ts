import { expect } from '@wdio/globals';
import { checkNativeScreen, checkWebPage } from '../../support/a11y.js';
import { inWebView, launchApp, resetApp } from '../../support/app.js';
import WebAnalysis from '../../webpages/WebAnalysisPage.js';
import { screenshot } from '../../support/report.js';

/** The real web app inside the app, at phone width: axe-core (WCAG 2.1 A/AA) on the start page and a results page. */
describe('Live site accessibility', () => {
    before(async () => {
        await resetApp();
        await launchApp();
    });

    it('the start page passes axe-core inside the app', async () => {
        const violations = await inWebView(async () => {
            await expect(WebAnalysis.analyzeButton).toBeEnabled({ wait: 60_000 });
            return checkWebPage('live start page');
        });
        expect(violations).toEqual([]);
        expect(await checkNativeScreen('live start screen')).toEqual([]);
    });

    it('a results page passes axe-core inside the app', async () => {
        const violations = await inWebView(async () => {
            await WebAnalysis.search('KO');
            await expect(WebAnalysis.companyName).toHaveText('COCA COLA CO (KO)', { wait: 90_000 });
            return checkWebPage('live results for KO');
        });
        await screenshot('live results checked with axe');
        expect(violations).toEqual([]);
    });
});
