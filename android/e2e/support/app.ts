import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { APP_ID, MAIN_ACTIVITY } from './capabilities.js';

const EXTRA_SITE_URL = `${APP_ID}.SITE_URL`;
const EXTRA_OPEN_URL = `${APP_ID}.OPEN_URL`;

/** Runs host-side adb (for `adb reverse`, which Appium's shell can't do). */
export function adb(...args: string[]): string {
    const home = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
    const bin = home ? join(home, 'platform-tools', 'adb') : 'adb';
    const serial = process.env.ANDROID_SERIAL ? ['-s', process.env.ANDROID_SERIAL] : [];
    return execFileSync(bin, [...serial, ...args], { encoding: 'utf8' });
}

/** Lets the device reach a port on this computer as its own localhost (debug builds allow http://localhost). */
export function reversePort(devicePort: number, hostPort = devicePort): void {
    adb('reverse', `tcp:${devicePort}`, `tcp:${hostPort}`);
}

export function removeReverse(devicePort: number): void {
    try {
        adb('reverse', '--remove', `tcp:${devicePort}`);
    } catch {
        // already gone
    }
}

/**
 * Stops the app and wipes its data (watchlist, WebView storage), then re-grants notifications (clearing revokes them).
 * Uses host-side adb rather than Appium's `mobile: shell`, which Appium 3 only allows with --allow-insecure.
 */
export async function resetApp(): Promise<void> {
    await driver.execute('mobile: terminateApp', { appId: APP_ID });
    await driver.execute('mobile: clearApp', { appId: APP_ID });
    if (Number(adb('shell', 'getprop', 'ro.build.version.sdk').trim()) >= 33) {
        adb('shell', 'pm', 'grant', APP_ID, 'android.permission.POST_NOTIFICATIONS');
    }
}

/**
 * Starts the app. `site` points a debug build at another copy of the web app (the mock server);
 * `open` opens a particular page, as a notification tap does.
 */
export async function launchApp(options: { site?: string; open?: string } = {}): Promise<void> {
    const extras: string[][] = [];
    if (options.site) extras.push(['s', EXTRA_SITE_URL, options.site]);
    if (options.open) extras.push(['s', EXTRA_OPEN_URL, options.open]);
    await driver.execute('mobile: startActivity', { component: MAIN_ACTIVITY, extras, stop: true, wait: true });
}

const contextName = (c: unknown): string => (typeof c === 'string' ? c : String((c as { id?: string }).id ?? ''));

/** Runs `fn` inside the app's WebView (the web page), then returns to the native screen. */
export async function inWebView<T>(fn: () => Promise<T>): Promise<T> {
    let webview = '';
    await browser.waitUntil(
        async () => {
            webview = (await driver.getContexts()).map(contextName).find((c) => c.startsWith('WEBVIEW')) ?? '';
            return webview !== '';
        },
        { timeout: 30_000, timeoutMsg: 'the app WebView never became inspectable' },
    );
    await driver.switchContext(webview);
    try {
        return await fn();
    } finally {
        await driver.switchContext('NATIVE_APP');
    }
}

/** A UiAutomator selector for a view id in the app, e.g. byId('retry'). */
export const byId = (id: string) => `android=new UiSelector().resourceId("${APP_ID}:id/${id}")`;
export const byText = (text: string) => `android=new UiSelector().text("${text}")`;
export const byTextContains = (text: string) => `android=new UiSelector().textContains("${text}")`;
