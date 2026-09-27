import { expect } from '@wdio/globals';
import MainScreen from '../../screens/MainScreen.js';
import { checkWebPage } from '../../support/a11y.js';
import { inWebView, launchApp, resetApp } from '../../support/app.js';
import { screenshot } from '../../support/report.js';

const LIVE = 'https://stock-value-analysis.vercel.app/';

/**
 * The web app's compare page inside the Android app (live site, real SEC data): it opens in the app from a result,
 * compares a second company, links back to each full analysis, and the native Watch star follows the page.
 */
describe('Compare two stocks in the app (live site)', () => {
    before(async () => {
        await resetApp();
        await launchApp({ open: `${LIVE}?t=KO` });
    });

    it('opens the compare page inside the app with the first company loaded', async () => {
        await inWebView(async () => {
            await expect($('#coName')).toHaveText('COCA COLA CO (KO)', { wait: 90_000 });
            await $('#compareLink').click();
        });
        // A new page: reconnect instead of keeping chromedriver on the old one (the CI WebView drops it).
        await inWebView(async () => {
            await expect(browser).toHaveUrl(expect.stringContaining('/compare.html?a=KO'), { wait: 30_000 });
            await expect($('#statusA')).toHaveText('COCA COLA CO (KO)', { wait: 60_000 });
        }, { retries: 1 });
        await expect(MainScreen.pageArea).toBeDisplayed(); // still in the app, not the browser
        await expect(MainScreen.anyWatchButton).not.toBeExisting(); // the compare page isn't one company
        await screenshot('compare page with KO loaded');
    });

    it('compares a second company from real SEC data', async () => {
        await inWebView(async () => {
            await $('#tickerB').setValue('PEP');
            await $('#goB').click();
            await expect($('#cmpResult')).toBeDisplayed({ wait: 90_000 });
            await expect(browser).toHaveUrl(expect.stringContaining('a=KO&b=PEP'));
            await expect($$('#cmpCards .cmp-card')).toBeElementsArrayOfSize(2);
            await expect($('#cmpCards')).toHaveText(expect.stringContaining('PEPSICO INC (PEP)'));
            await expect($('#cmpTable')).toHaveText(expect.stringContaining('Debt / equity'));
            const chart = await $('#cmpRevenue').getSize();
            expect(chart.height).toBeGreaterThan(100); // the growth chart is drawn
        });
        await screenshot('KO vs PEP in the app');
    });

    it('the compare page passes axe-core inside the app', async () => {
        const violations = await inWebView(() => checkWebPage('live compare page'), { retries: 1 });
        expect(violations).toEqual([]);
    });

    it('"Open full analysis" stays in the app and brings back the Watch star', async () => {
        await inWebView(async () => {
            await $('#cmpCards .cmp-card:nth-child(2) a').click(); // PEP's card
        });
        await inWebView(async () => {
            await expect($('#coName')).toHaveText('PEPSICO INC (PEP)', { wait: 90_000 });
        }, { retries: 1 });
        await expect(MainScreen.watchButton('PEP')).toBeDisplayed({ wait: 20_000 });
    });

    it('Back returns to the comparison, and the star goes away again', async () => {
        await driver.back();
        await inWebView(async () => {
            await expect(browser).toHaveUrl(expect.stringContaining('compare.html'), { wait: 30_000 });
            await expect($('#cmpResult')).toBeDisplayed({ wait: 90_000 }); // both companies restored from the address
        }, { retries: 1 });
        await expect(MainScreen.anyWatchButton).not.toBeExisting();
    });

    it('shows the comparison in Spanish inside the app', async () => {
        await launchApp({ open: `${LIVE}compare.html?a=KO&b=PEP&lang=es` });
        await inWebView(async () => {
            await expect($('#goB')).toHaveText('Comparar', { wait: 60_000 });
            await expect($('#cmpResult')).toBeDisplayed({ wait: 90_000 });
            await expect($('#cmpTable')).toHaveText(expect.stringContaining('Deuda / patrimonio'));
            await expect($('#cmpCards')).toHaveText(expect.stringContaining('Ver el análisis completo'));
        }, { retries: 1 });
        await screenshot('comparison in Spanish');
    });
});
