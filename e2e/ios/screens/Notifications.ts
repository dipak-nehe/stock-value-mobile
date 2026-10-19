import allureReporter from '@wdio/allure-reporter';
import { activateApp, byLabelContains } from '../support/app.js';
import { screenshot } from '../support/report.js';

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
        await this.waitForAny([text], timeout);
    }

    /**
     * Opens Notification Center and waits for a notification containing any of `texts`; returns the one found.
     * iOS stacks an app's notifications, newest on top, and only the top card can be read, so a test that expects
     * several alerts asks for any of them. The swipe that opens Notification Center doesn't always take on the
     * simulator, so if nothing shows up, close and swipe again (3 tries in all).
     */
    async waitForAny(texts: string[], timeout = 60_000): Promise<string> {
        const tries = 3, each = Math.round(timeout / tries);
        for (let attempt = 1; attempt <= tries; attempt++) {
            await this.open();
            const found = await browser.waitUntil(async () => {
                for (const text of texts) if (await this.notification(text).isDisplayed().catch(() => false)) return text;
                return false;
            }, { timeout: each, interval: 1_000 }).catch(() => false);
            // Evidence for the report: what Notification Center contained.
            allureReporter.addAttachment(`Notification Center UI tree (try ${attempt})`, await driver.getPageSource(), 'application/xml');
            if (found) return found as string;
            if (attempt < tries) await this.close();
        }
        throw new Error(`no notification with ${texts.map((t) => `"${t}"`).join(' or ')}`);
    }

    /**
     * Opens a notification and checks it really opened what it should: `opened` is asked after each try (e.g. "is the
     * company's page showing?"). Closing Notification Center isn't proof: a gesture can close it without opening the
     * notification (the app then stays on its start page). So each try reopens Notification Center, finds the card
     * again, uses one way of opening it, and asks `opened`; the next try uses the next way.
     * iOS 26 on the simulator: a synthesized tap on a card doesn't always open it, a swipe right sometimes does.
     */
    async openUntil(texts: string[], opened: () => Promise<boolean>): Promise<void> {
        const ways: [string, (r: { x: number; y: number; width: number; height: number }, card: WebdriverIO.Element) => Promise<unknown>][] = [
            ['coordinate tap', (r) => driver.execute('mobile: tap', { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) })],
            ['swipe right', (r) => driver.execute('mobile: dragFromToForDuration', { fromX: r.x + 20, fromY: Math.round(r.y + r.height / 2), toX: r.x + r.width - 10, toY: Math.round(r.y + r.height / 2), duration: 0.3 })],
            ['element tap', (_r, card) => card.click()],
            ['coordinate tap, again', (r) => driver.execute('mobile: tap', { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) })],
        ];
        const tried: string[] = [];
        for (const [name, way] of ways) {
            const text = await this.waitForAny(texts);
            // Several elements contain the text (the card and a container spanning cards): use the smallest, the card.
            let card = await this.notification(text).getElement();
            let rect = { x: 0, y: 0, width: 0, height: 0 }, smallest = Infinity;
            for (const el of await $$(byLabelContains(text))) {
                const r = await driver.getElementRect(await el.elementId);
                if (r.height > 20 && r.width * r.height < smallest) { smallest = r.width * r.height; rect = r; card = el as unknown as WebdriverIO.Element; }
            }
            // While the app opens the screen keeps animating: don't let Appium wait for it to settle after the gesture.
            await driver.updateSettings({ waitForIdleTimeout: 0, animationCoolOffTimeout: 0 });
            try {
                await way(rect, card).catch(() => undefined);
                await browser.pause(2_000);
            } finally {
                await driver.updateSettings({ waitForIdleTimeout: 10, animationCoolOffTimeout: 2, defaultActiveApplication: 'auto' });
            }
            await screenshot(`after ${name}`);
            const ok = await opened().catch(() => false);
            tried.push(`${name}: ${ok ? 'opened' : 'not opened'}`);
            if (ok) {
                allureReporter.addAttachment('how the notification was opened', tried.join('\n'), 'text/plain');
                return;
            }
            // Back to the app, so the next try starts from the same place
            await driver.execute('mobile: pressButton', { name: 'home' }).catch(() => undefined);
            await activateApp();
            await browser.pause(1_000);
        }
        allureReporter.addAttachment('how the notification was opened', tried.join('\n'), 'text/plain');
        throw new Error(`the notification didn't open the page (${tried.join('; ')})`);
    }
}

export default new Notifications();
