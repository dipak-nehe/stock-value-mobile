import allureReporter from '@wdio/allure-reporter';
import { activateApp, byLabelContains } from '../support/app.js';

/**
 * iOS Notification Center. It belongs to the system (SpringBoard), not the app: while it's open, element lookups are
 * pointed at SpringBoard, and `close()` points them back at the app.
 */
class Notifications {
    /** Swipes down from the top-left edge (the top-right edge opens Control Center). */
    async open(): Promise<void> {
        await driver.updateSettings({ defaultActiveApplication: 'com.apple.springboard' });
        const { width, height } = await driver.getWindowSize();
        const x = Math.round(width * 0.25);
        await driver
            .action('pointer', { parameters: { pointerType: 'touch' } })
            .move({ x, y: 2 })
            .down()
            .pause(150)
            .move({ x, y: Math.round(height * 0.75), duration: 600 })
            .up()
            .perform();
        await browser.pause(1_000);
    }

    /** Leaves Notification Center via the Home screen and brings the app back. */
    async close(): Promise<void> {
        await driver.execute('mobile: pressButton', { name: 'home' });
        await driver.updateSettings({ defaultActiveApplication: 'auto' });
        await activateApp();
        await browser.pause(1_000);
    }

    /** The first notification whose text contains `text` (a notification's label holds its title and body). */
    notification(text: string) {
        return $(byLabelContains(text));
    }

    /**
     * The texts of every notification element containing `text`. iOS 26 exposes each notification card as more
     * than one element (the card and its content), so compare texts rather than count elements.
     */
    async texts(text: string): Promise<string[]> {
        return $$(byLabelContains(text)).map(async (e) => (await e.getAttribute('label')) ?? '');
    }

    /** Opens Notification Center and waits for a notification containing `text`. */
    async waitFor(text: string, timeout = 60_000): Promise<void> {
        await this.open();
        await this.notification(text).waitForDisplayed({ timeout, timeoutMsg: `no notification with "${text}"` });
        // Evidence for the report: what Notification Center contained.
        allureReporter.addAttachment('Notification Center UI tree', await driver.getPageSource(), 'application/xml');
    }

    /**
     * Taps a notification: iOS closes Notification Center and opens the app, which loads the company's page.
     * An element tap on a notification card doesn't always reach it on iOS 26, so if Notification Center is still
     * showing, tap the card's centre by its coordinates.
     */
    async tap(text: string): Promise<void> {
        const card = this.notification(text);
        const { x, y, width, height } = await card.getLocation().then(async (at) => ({ ...at, ...(await card.getSize()) }));
        await card.click();
        const opened = () => card.isDisplayed().then((shown) => !shown, () => true);
        if (!(await browser.waitUntil(opened, { timeout: 4_000 }).catch(() => false))) {
            await driver.execute('mobile: tap', { x: Math.round(x + width / 2), y: Math.round(y + height / 2) });
            await browser.waitUntil(opened, { timeout: 10_000, timeoutMsg: 'Notification Center stayed open after tapping the notification' });
        }
        await driver.updateSettings({ defaultActiveApplication: 'auto' });
        await browser.pause(1_000);
    }
}

export default new Notifications();
