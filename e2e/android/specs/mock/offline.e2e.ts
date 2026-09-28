import { expect } from '@wdio/globals';
import MainScreen from '../../screens/MainScreen.js';
import MockPage from '../../../shared/webpages/MockPage.js';
import { MockSite } from '../../../shared/mockSite.js';
import { inWebView, launchApp, removeReverse, resetApp, reversePort } from '../../support/app.js';
import { screenshot } from '../../support/report.js';

describe('Offline screen', () => {
    const site = new MockSite(8765);
    const unreachable = 8766; // nothing listens here until the test "brings the site back"

    before(async () => {
        await site.start();
        removeReverse(unreachable);
        await resetApp();
    });

    after(async () => {
        removeReverse(unreachable);
        await site.stop();
    });

    it('explains the problem when the site can\'t be reached', async () => {
        await launchApp({ site: `http://localhost:${unreachable}/` });
        await expect(MainScreen.offlineTitle).toBeDisplayed({ wait: 30_000 });
        await expect(MainScreen.offlineTitle).toHaveText("Can't reach the site");
        await expect(MainScreen.retryButton).toBeDisplayed();
        await screenshot('offline screen');
    });

    it('loads the page after "Try again" once the site is reachable', async () => {
        reversePort(unreachable, site.port);
        await MainScreen.retryButton.click();
        await expect(MainScreen.offlineTitle).not.toBeDisplayed({ wait: 30_000 });
        await inWebView(async () => {
            await expect(MockPage.title).toHaveText('Home');
        });
    });
});
