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
    // Through host adb with each value single-quoted for the device shell: addresses contain '&', which an unquoted
    // shell command (as `mobile: startActivity` builds it) treats as "run in background" and cuts the address there.
    const quote = (v: string) => `'${v.replace(/'/g, `'\\''`)}'`;
    const extras: string[] = [];
    if (options.site) extras.push('--es', EXTRA_SITE_URL, quote(options.site));
    if (options.open) extras.push('--es', EXTRA_OPEN_URL, quote(options.open));
    adb('shell', 'am', 'start', '-S', '-n', MAIN_ACTIVITY, ...extras);
    await driver.pause(500);
}

const contextName = (c: unknown): string => (typeof c === 'string' ? c : String((c as { id?: string }).id ?? ''));

/**
 * Runs `fn` inside the app's WebView (the web page), then returns to the native screen.
 * Other apps on the device (e.g. Google system apps) have WebViews too, so pick this app's by name; a context can
 * also vanish between listing and switching while the page loads, so retry the switch.
 */
/** Switch Appium to this app's WebView, waiting for it to appear (chromedriver on an older WebView can take a minute). */
async function switchToWebView(): Promise<void> {
    const ours = `WEBVIEW_${APP_ID}`;
    let lastError = 'no attempt finished';
    await browser.waitUntil(
        async () => {
            const contexts = (await driver.getContexts()).map(contextName);
            if (!contexts.includes(ours)) {
                lastError = `contexts: ${contexts.join(', ')}`;
                return false;
            }
            try {
                await driver.switchContext(ours);
                return true;
            } catch (e) {
                lastError = String(e);
                return false;
            }
        },
        { timeout: 150_000, interval: 2_000 },
    ).catch(() => {
        throw new Error(`could not switch to the app's WebView: ${lastError}`);
    });
}

export async function inWebView<T>(fn: () => Promise<T>, options: { retries?: number } = {}): Promise<T> {
    await switchToWebView();
    try {
        for (let attempt = 0; ; attempt++) {
            try {
                return await fn();
            } catch (e) {
                // The page can restart under chromedriver right after the app launches; read-only checks may retry.
                if (attempt >= (options.retries ?? 0) || !/not connected to DevTools|chrome not reachable|target window already closed|no such context/i.test(String(e))) throw e;
                await browser.pause(3_000);
                await driver.switchContext('NATIVE_APP');
                await switchToWebView(); // wait for the page to reappear, as on the first switch
            }
        }
    } finally {
        await driver.switchContext('NATIVE_APP');
    }
}

/**
 * Sets the app's own language (Android 13+ per-app language; the app declares en and es in its localeConfig).
 * Pass null to follow the phone's language again. Takes effect the next time the screen is created.
 */
export function setAppLanguage(locale: string | null): void {
    adb('shell', 'cmd', 'locale', 'set-app-locales', APP_ID, '--locales', locale ?? "''");
}

/** A UiAutomator selector for a view id in the app, e.g. byId('retry'). */
export const byId = (id: string) => `android=new UiSelector().resourceId("${APP_ID}:id/${id}")`;
export const byText = (text: string) => `android=new UiSelector().text("${text}")`;
export const byTextContains = (text: string) => `android=new UiSelector().textContains("${text}")`;
/** Buttons show their text in capitals, so match text regardless of case. */
export const byButtonText = (text: string) => `android=new UiSelector().textMatches("(?i)${text}")`;
