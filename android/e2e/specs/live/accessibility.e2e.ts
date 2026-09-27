import { expect } from '@wdio/globals';
import { checkNativeScreen, checkWebPage } from '../../support/a11y.js';
import { inWebView, launchApp, resetApp } from '../../support/app.js';
import { screenshot } from '../../support/report.js';

/** The real web app inside the app, at phone width: axe-core (WCAG 2.1 A/AA) on the start page and a results page. */
describe('Live site accessibility', () => {
    before(async () => {
        await resetApp();
        await launchApp();
    });

    it('the start page passes axe-core inside the app', async () => {
        const violations = await inWebView(async () => {
            await expect($('#go')).toBeEnabled({ wait: 60_000 });
            return checkWebPage('live start page');
        });
        expect(violations).toEqual([]);
        expect(await checkNativeScreen('live start screen')).toEqual([]);
    });

    it('a results page passes axe-core inside the app', async () => {
        const violations = await inWebView(async () => {
            await $('#ticker').setValue('KO');
            await $('#go').click();
            await expect($('#coName')).toHaveText('COCA COLA CO (KO)', { wait: 90_000 });
            return checkWebPage('live results for KO');
        });
        await screenshot('live results checked with axe');
        expect(violations).toEqual([]);
    });
});
