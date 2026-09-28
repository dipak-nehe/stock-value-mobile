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
        // Several elements contain the text: a container spanning several cards (its centre can sit on another app's
        // notification) and the card itself. Use the smallest one, which is the card.
        let card = this.notification(text);
        let rect = { x: 0, y: 0, width: 0, height: 0 };
        let smallest = Infinity;
        for (const el of await $$(byLabelContains(text))) {
            const r = await driver.getElementRect(await el.elementId);
            if (r.height > 20 && r.width * r.height < smallest) {
                smallest = r.width * r.height;
                rect = r;
                card = el as unknown as typeof card;
            }
        }
        const { x, y, width, height } = rect;
        const cx = Math.round(x + width / 2), cy = Math.round(y + height / 2);
        const opened = () => card.isDisplayed().then((shown) => !shown, () => true);
        // iOS 26 doesn't always open the app for a synthesized tap on a Notification Center card, so try, in turn:
        // an element tap, a coordinate tap, then a swipe right across the card (which opens a notification there).
        const attempts: [string, () => Promise<unknown>][] = [
            ['element tap', () => card.click()],
            ['coordinate tap', () => driver.execute('mobile: tap', { x: cx, y: cy })],
            ['swipe right', () => driver.execute('mobile: dragFromToForDuration', { fromX: x + 20, fromY: cy, toX: x + width - 10, toY: cy, duration: 0.3 })],
        ];
        let worked = '';
        for (const [name, attempt] of attempts) {
            await attempt().catch(() => undefined);
            if (await browser.waitUntil(opened, { timeout: 5_000 }).catch(() => false)) {
                worked = name;
                break;
            }
        }
        allureReporter.addAttachment('how the notification was opened', worked || 'none of: element tap, coordinate tap, swipe right', 'text/plain');
        await driver.updateSettings({ defaultActiveApplication: 'auto' });
        if (!worked) throw new Error('Notification Center stayed open after tapping, tapping by position and swiping the notification');
        await browser.pause(1_000);
    }
}

export default new Notifications();
