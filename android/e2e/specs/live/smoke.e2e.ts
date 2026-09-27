import { expect } from '@wdio/globals';
import MainScreen from '../../screens/MainScreen.js';
import { inWebView, launchApp, resetApp } from '../../support/app.js';

/** Against the real site: proves the app works with the live web app and SEC data, not only with the mock. */
describe('Live site smoke test', () => {
    before(async () => {
        await resetApp();
        await launchApp(); // no override: https://stock-value-analysis.vercel.app
    });

    it('loads the live web app and analyses a company from real SEC data', async () => {
        // One switch into the page for the whole web flow.
        await inWebView(async () => {
            await expect($('h1')).toHaveText(expect.stringContaining('10-Year Stock Value Analysis'), { wait: 60_000 });
            await expect($('#go')).toBeEnabled({ wait: 30_000 }); // the page's script has loaded
            await $('#ticker').setValue('KO');
            await $('#go').click();
            await expect($('#coName')).toHaveText('COCA COLA CO (KO)', { wait: 90_000 });
            await expect($('#glance')).toBeDisplayed();
        });
    });

    it('offers the Watch star for that company', async () => {
        await expect(MainScreen.watchButton('KO')).toBeDisplayed({ wait: 20_000 });
    });
});
