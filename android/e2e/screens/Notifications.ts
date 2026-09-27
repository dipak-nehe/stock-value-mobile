import { byTextContains } from '../support/app.js';

/** The system notification shade. */
class Notifications {
    async open(): Promise<void> {
        await driver.openNotifications();
    }

    async close(): Promise<void> {
        await driver.back();
    }

    notification(text: string) {
        return $(byTextContains(text));
    }

    /** Opens the shade and waits for a notification containing `text`. */
    async waitFor(text: string, timeout = 60_000): Promise<void> {
        await this.open();
        await this.notification(text).waitForDisplayed({ timeout, timeoutMsg: `no notification with "${text}"` });
    }
}

export default new Notifications();
