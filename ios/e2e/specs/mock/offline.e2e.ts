import { expect } from '@wdio/globals';
import MainScreen from '../../screens/MainScreen.js';
import MockPage from '../../webpages/MockPage.js';
import { MockSite } from '../../support/mockSite.js';
import { inWebView, launchApp, resetApp } from '../../support/app.js';
import { screenshot } from '../../support/report.js';

describe('Offline screen', () => {
    // Nothing listens on this port until the test "brings the site back" by starting a mock there.
    const site = new MockSite(8766);

    before(async () => {
        await resetApp();
    });

    after(async () => {
        await site.stop();
    });

    it('explains the problem when the site can\'t be reached', async () => {
        await launchApp({ site: site.url });
        await expect(MainScreen.offlineTitle).toBeDisplayed({ wait: 30_000 });
        await expect(MainScreen.offlineTitle).toHaveText("Can't reach the site");
        await expect(MainScreen.retryButton).toBeDisplayed();
        await screenshot('offline screen');
    });

    it('loads the page after "Try again" once the site is reachable', async () => {
        await site.start();
        await MainScreen.retryButton.click();
        await expect(MainScreen.offlineTitle).not.toBeDisplayed({ wait: 30_000 });
        await inWebView(async () => {
            await expect(MockPage.title).toHaveText('Home');
        });
    });
});
