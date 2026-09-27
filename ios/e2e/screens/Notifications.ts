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

    /** Every notification containing `text` (e.g. to count one company's alerts). */
    notifications(text: string) {
        return $$(`-ios predicate string:type == "XCUIElementTypeButton" AND label CONTAINS "${text}"`);
    }

    /** Opens Notification Center and waits for a notification containing `text`. */
    async waitFor(text: string, timeout = 60_000): Promise<void> {
        await this.open();
        await this.notification(text).waitForDisplayed({ timeout, timeoutMsg: `no notification with "${text}"` });
    }

    /** Taps a notification: iOS opens the app, which loads the company's page. */
    async tap(text: string): Promise<void> {
        await this.notification(text).click();
        await driver.updateSettings({ defaultActiveApplication: 'auto' });
        await browser.pause(1_000);
    }
}

export default new Notifications();
