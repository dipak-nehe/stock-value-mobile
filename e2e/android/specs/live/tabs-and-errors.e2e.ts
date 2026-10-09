import { expect } from '@wdio/globals';
import MainScreen from '../../screens/MainScreen.js';
import WatchlistScreen from '../../screens/WatchlistScreen.js';
import WebAnalysis, { TABS, type Tab } from '../../../shared/webpages/WebAnalysisPage.js';
import { inWebView, launchApp, resetApp } from '../../support/app.js';
import { screenshot } from '../../support/report.js';

const LIVE = 'https://stock-value-analysis.vercel.app/';

/** What each tab must show for Coca-Cola (live site, real SEC data). */
const CONTENT: Record<Tab, () => Promise<void>> = {
    overview: () => expect(WebAnalysis.trendTiles).toBeDisplayed(),
    flags: () => expect(WebAnalysis.flags).toBeDisplayed(),
    history: () => expect(WebAnalysis.historyTiles).toBeElementsArrayOfSize(6),
    insiders: () => expect(WebAnalysis.insiders).toBeDisplayed(),
    value: () => expect(WebAnalysis.grahamScore).toHaveText(expect.stringMatching(/\d+ of \d+/)),
    durable: () => expect(WebAnalysis.durableScore).toHaveText(expect.stringMatching(/\d+ of \d+/)),
    charts: async () => expect((await WebAnalysis.chart('cRevenue').getSize()).height).toBeGreaterThan(100),
    data: () => expect(WebAnalysis.dataTable).toBeDisplayed(),
};

/**
 * The web app's tabs and its wrong-ticker error, inside the app (live site). Mirrors the web app's own
 * "tab tour" and wrong-ticker tests, and checks the app side: no Watch for a ticker SEC doesn't know.
 */
describe('Live site in the app: every tab, and a wrong ticker', () => {
    before(async () => {
        await resetApp();
        await launchApp({ open: `${LIVE}?t=KO` });
    });

    it('opens each tab on its own, with its content', async () => {
        await inWebView(async () => {
            await expect(WebAnalysis.companyName).toHaveText('COCA COLA CO (KO)', { wait: 90_000 });
        }, { retries: 1 });
        for (const tab of TABS) {
            await inWebView(async () => {
                await WebAnalysis.tab(tab).click();
                await expect(WebAnalysis.tab(tab)).toHaveAttribute('aria-selected', 'true');
                await expect(WebAnalysis.panel(tab)).toBeDisplayed();
                for (const other of TABS.filter((o) => o !== tab)) await expect(WebAnalysis.panel(other)).not.toBeDisplayed();
                await expect(browser).toHaveUrl(tab === 'overview' ? expect.stringContaining('?t=KO') : expect.stringContaining(`#${tab}`));
                await CONTENT[tab]();
            }, { retries: 1 });
            await screenshot(`${tab} tab in the app`);
        }
    });

    it('shows a wrong ticker\'s error where you can see it, and forgets the previous company', async () => {
        await inWebView(async () => {
            await WebAnalysis.search('ZZZZQ');
            await expect(WebAnalysis.error).toHaveText(expect.stringContaining("Ticker 'ZZZZQ' not found"), { wait: 60_000 });
            expect(await WebAnalysis.isInViewport(WebAnalysis.error)).toBe(true);
            await expect(WebAnalysis.companyName).not.toBeDisplayed();
            await expect(browser).toHaveUrl(expect.stringContaining('?t=ZZZZQ'));
        });
        await screenshot('wrong ticker error in the app');
    });

    it('won\'t watch a ticker SEC doesn\'t know', async () => {
        // The page address now holds ZZZZQ, so the star shows; tapping it must not add it.
        await MainScreen.watchButton('ZZZZQ').click();
        await browser.pause(3_000); // the app asks the site about ZZZZQ first
        await expect(MainScreen.watchingButton('ZZZZQ')).not.toBeExisting();
        await MainScreen.openWatchlist();
        await expect(WatchlistScreen.emptyMessage).toBeDisplayed();
        await screenshot('Watchlist still empty');
    });
});
