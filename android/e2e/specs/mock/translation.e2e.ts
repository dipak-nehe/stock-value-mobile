import { expect } from '@wdio/globals';
import MainScreen from '../../screens/MainScreen.js';
import Notifications from '../../screens/Notifications.js';
import WatchlistScreen from '../../screens/WatchlistScreen.js';
import { MockSite, type Report } from '../../support/mockSite.js';
import { byText, byTextContains, launchApp, removeReverse, resetApp, reversePort, setAppLanguage } from '../../support/app.js';
import { screenshot } from '../../support/report.js';

const Q2: Report = { form: '10-Q', date: '2026-04-28', accession: '0000021344-26-000010', url: 'https://www.sec.gov/q2.htm' };
const Q3: Report = { form: '10-Q', date: '2026-07-29', accession: '0000021344-26-000020', url: 'https://www.sec.gov/q3.htm' };

/** The app switched to Spanish with Android's per-app language setting: every native text, and the alerts. */
describe('Spanish (per-app language)', () => {
    const site = new MockSite(8765);

    before(async () => {
        site.report = Q2;
        await site.start();
        reversePort(site.port);
        await resetApp();
        setAppLanguage('es-ES');
        await launchApp({ site: site.url, open: `${site.url}?t=KO` });
    });

    after(async () => {
        setAppLanguage(null);
        removeReverse(site.port);
        await site.stop();
    });

    it('labels the toolbar actions in Spanish', async () => {
        await expect($('~Seguimiento')).toBeDisplayed();
        await expect($('~Seguir las presentaciones de KO')).toBeDisplayed();
        await screenshot('results screen in Spanish');
    });

    it('shows the Watchlist in Spanish', async () => {
        await $('~Seguir las presentaciones de KO').click();
        await expect($('~Siguiendo KO (toca para dejar de seguir)')).toBeDisplayed();
        await $('~Seguimiento').click();
        await expect($(byText('Comprobar ahora'))).toBeDisplayed();
        await expect($(byTextContains('Recibirás una notificación'))).toBeDisplayed();
        await WatchlistScreen.waitForDetail('Último informe: 10-Q presentado el 2026-04-28');
        await screenshot('Watchlist in Spanish');
    });

    it('sends the filing alert in Spanish', async () => {
        site.report = Q3;
        await $(byText('Comprobar ahora')).click();
        await Notifications.waitFor('Ha presentado un nuevo 10-Q el 2026-07-29');
        await screenshot('Spanish notification');
        await Notifications.close();
    });

    it('shows the empty Watchlist and the offline screen in Spanish', async () => {
        await $('~Dejar de seguir KO').click();
        await expect(WatchlistScreen.emptyMessage).toHaveText(expect.stringContaining('Aún no sigues ninguna empresa'));
        await launchApp({ site: 'http://localhost:8767/' });
        await expect(MainScreen.offlineTitle).toHaveText('No se puede acceder al sitio', { wait: 30_000 });
        await expect($(byText('Reintentar'))).toBeDisplayed();
        await screenshot('offline screen in Spanish');
    });
});
