import { expect } from '@wdio/globals';
import { MainScreen } from '../../screens/MainScreen.js';
import Notifications from '../../screens/Notifications.js';
import { WatchlistScreen } from '../../screens/WatchlistScreen.js';
import { MockSite, type Report } from '../../../shared/mockSite.js';
import { launchApp, resetApp } from '../../support/app.js';
import { screenshot } from '../../support/report.js';

const Q2: Report = { form: '10-Q', date: '2026-04-28', accession: '0000021344-26-000010', url: 'https://www.sec.gov/q2.htm' };
const Q3: Report = { form: '10-Q', date: '2026-07-29', accession: '0000021344-26-000020', url: 'https://www.sec.gov/q3.htm' };

/** The app in Spanish (the per-app language, set at launch): every native text, and the alerts. */
describe('Spanish (per-app language)', () => {
    const site = new MockSite(8765);
    // The same screen objects, with their Spanish names.
    const main = new MainScreen('es');
    const watchlist = new WatchlistScreen('es');

    before(async () => {
        site.report = Q2;
        await site.start();
        await resetApp();
        await launchApp({ site: site.url, open: `${site.url}?t=KO`, lang: 'es' });
    });

    after(async () => {
        await site.stop();
    });

    it('labels the toolbar actions in Spanish', async () => {
        await expect(main.watchlistButton).toBeDisplayed({ wait: 30_000 });
        await expect(main.watchButton('KO')).toBeDisplayed();
        await screenshot('results screen in Spanish');
    });

    it('shows the Watchlist in Spanish', async () => {
        await main.watch('KO');
        await expect(main.watchingButton('KO')).toBeDisplayed();
        await main.openWatchlist();
        await expect(watchlist.checkNowButton).toHaveText('Comprobar ahora');
        await expect(watchlist.intro).toHaveText(expect.stringContaining('Recibirás una notificación'));
        await watchlist.waitForDetail('Último informe: 10-Q presentado el 2026-04-28');
        await screenshot('Watchlist in Spanish');
    });

    it('sends the filing alert in Spanish', async () => {
        site.report = Q3;
        await watchlist.checkNowButton.click();
        await watchlist.waitForDetail('Último informe: 10-Q presentado el 2026-07-29');
        await Notifications.waitFor('Ha presentado un nuevo 10-Q el 2026-07-29');
        await screenshot('Spanish notification');
        await Notifications.close();
    });

    it('shows the empty Watchlist and the offline screen in Spanish', async () => {
        if (!(await watchlist.removeButton('KO').isDisplayed())) await main.openWatchlist();
        await watchlist.removeButton('KO').click();
        await expect(watchlist.emptyMessage).toHaveText(expect.stringContaining('Aún no sigues ninguna empresa'));
        await launchApp({ site: 'http://localhost:8767/', lang: 'es' }); // nothing listens there
        await expect(main.offlineTitle).toHaveText('No se puede acceder al sitio', { wait: 30_000 });
        await expect(main.retryButton).toHaveText('Reintentar');
        await screenshot('offline screen in Spanish');
    });
});
