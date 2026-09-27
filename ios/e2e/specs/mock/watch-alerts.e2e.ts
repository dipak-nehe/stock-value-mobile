import { expect } from '@wdio/globals';
import MainScreen from '../../screens/MainScreen.js';
import Notifications from '../../screens/Notifications.js';
import WatchlistScreen from '../../screens/WatchlistScreen.js';
import MockPage from '../../webpages/MockPage.js';
import { MockSite, type Report } from '../../support/mockSite.js';
import { inWebView, launchApp, resetApp } from '../../support/app.js';
import { screenshot } from '../../support/report.js';

const Q2: Report = { form: '10-Q', date: '2026-04-28', accession: '0000021344-26-000010', url: 'https://www.sec.gov/q2.htm' };
const Q3: Report = { form: '10-Q', date: '2026-07-29', accession: '0000021344-26-000020', url: 'https://www.sec.gov/q3.htm' };

describe('Filing alerts', () => {
    const site = new MockSite(8765);

    before(async () => {
        site.report = Q2;
        await site.start();
        await resetApp();
        await launchApp({ site: site.url, open: `${site.url}?t=KO` });
    });

    after(async () => {
        await site.stop();
    });

    it('offers a Watch star on a company\'s results page', async () => {
        await inWebView(async () => {
            await expect(MockPage.title).toHaveText('KO results');
        });
        await expect(MainScreen.watchButton('KO')).toBeDisplayed();
    });

    it('watching records the current filings as the starting point, without a notification', async () => {
        await MainScreen.watch('KO');
        await expect(MainScreen.watchingButton('KO')).toBeDisplayed();
        await expect(MainScreen.toast).toHaveText(expect.stringContaining('Watching KO'));

        await MainScreen.openWatchlist();
        await expect(WatchlistScreen.row('KO')).toHaveText(expect.stringContaining('COCA COLA CO (KO)'), { wait: 60_000 });
        await WatchlistScreen.waitForDetail('Latest report: 10-Q filed 2026-04-28');
        await screenshot('Watchlist after watching KO');

        await Notifications.open();
        await expect(Notifications.notification('COCA COLA CO')).not.toBeExisting();
        await Notifications.close();
    });

    it('notifies about a new quarterly report and a late-filing notice', async () => {
        site.report = Q3;
        site.events = [
            { date: '2026-08-15', type: 'late_filing', form: 'NT 10-K', url: 'https://www.sec.gov/nt.htm' },
            { date: '2026-08-01', type: 'sec_letter', form: 'UPLOAD', url: 'https://www.sec.gov/letter.pdf' },
        ];
        if (!(await WatchlistScreen.checkNowButton.isDisplayed())) await MainScreen.openWatchlist();
        await WatchlistScreen.checkNowButton.click();
        await WatchlistScreen.waitForDetail('Latest report: 10-Q filed 2026-07-29');

        await Notifications.waitFor('Filed a new 10-Q on 2026-07-29');
        await expect(Notifications.notification('late-filing notice (NT 10-K)')).toBeDisplayed();
        await screenshot('Notification Center with the two alerts');
        // exactly two: the report and the late filing; the SEC letter isn't announced
        await expect(Notifications.notifications('COCA COLA CO (KO)')).toBeElementsArrayOfSize(2);
        await Notifications.close();
    });

    it('tapping a notification opens the company\'s analysis', async () => {
        await launchApp({ site: site.url }); // back on the start page first
        await inWebView(async () => {
            await expect(MockPage.title).toHaveText('Home');
        });
        site.requests.length = 0;
        await Notifications.waitFor('Filed a new 10-Q on 2026-07-29');
        await Notifications.tap('Filed a new 10-Q on 2026-07-29');
        await inWebView(async () => {
            await expect(MockPage.title).toHaveText('KO results', { wait: 30_000 });
            await expect(browser).toHaveUrl(expect.stringContaining('/?t=KO'));
        }, { retries: 1 });
        expect(site.requests).toContain('/?t=KO'); // the page was really requested after the tap
    });

    it('can stop watching from the Watchlist', async () => {
        await MainScreen.openWatchlist();
        await WatchlistScreen.removeButton('KO').click();
        await expect(WatchlistScreen.emptyMessage).toBeDisplayed();
        await WatchlistScreen.closeButton.click();
        await expect(MainScreen.watchButton('KO')).toBeDisplayed(); // the star is empty again
    });
});
