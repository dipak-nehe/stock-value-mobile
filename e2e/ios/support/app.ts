import { APP, BUNDLE_ID, WEB_INSPECTOR_IDS } from './capabilities.js';
import type { Lang } from '../../shared/lang.js';

/**
 * Removes and reinstalls the app: a clean start with no watchlist, no web storage, and none of its earlier
 * notifications left in Notification Center. (Removing it also forgets the notification permission; the first Watch
 * asks again, and `allowNotificationsIfAsked` answers.)
 */
export async function resetApp(): Promise<void> {
    await driver.execute('mobile: terminateApp', { bundleId: BUNDLE_ID }).catch(() => undefined);
    await driver.removeApp(BUNDLE_ID).catch(() => undefined); // not installed yet on a fresh simulator
    await driver.installApp(APP);
}

/**
 * Starts (or restarts) the app. `site` points a debug build at another copy of the web app (the mock server);
 * `open` opens a particular page, as a notification tap does; `lang` sets the app's language for this launch
 * (as the per-app language in Settings does).
 * The values are iOS launch arguments, which the app reads through UserDefaults (AppInfo.swift).
 */
export async function launchApp(options: { site?: string; open?: string; lang?: Lang } = {}): Promise<void> {
    const args: string[] = [];
    if (options.site) args.push('-SiteURL', options.site);
    if (options.open) args.push('-OpenURL', options.open);
    if (options.lang) args.push('-AppleLanguages', `(${options.lang})`, '-AppleLocale', options.lang === 'es' ? 'es_ES' : 'en_US');
    await driver.execute('mobile: terminateApp', { bundleId: BUNDLE_ID }).catch(() => undefined);
    // An array, not a shell command: addresses with '&' arrive intact.
    await driver.execute('mobile: launchApp', { bundleId: BUNDLE_ID, arguments: args });
}

/** Brings the app back to the front (e.g. after the Home screen or Notification Center). */
export async function activateApp(): Promise<void> {
    await driver.execute('mobile: activateApp', { bundleId: BUNDLE_ID });
}

/**
 * Answers iOS's "Allow notifications?" question with Allow, if it's showing (it's asked when the first company is
 * watched). The question comes from iOS, in the phone's language, so accept either language.
 */
export async function allowNotificationsIfAsked(timeout = 5_000): Promise<void> {
    const shown = await browser
        .waitUntil(async () => driver.getAlertText().then(() => true, () => false), { timeout, interval: 500 })
        .catch(() => false);
    if (!shown) return;
    const buttons = (await driver.execute('mobile: alert', { action: 'getButtons' })) as string[];
    const allow = buttons.find((b) => /^(Allow|Permitir)$/i.test(b)) ?? buttons[buttons.length - 1];
    await driver.execute('mobile: alert', { action: 'accept', buttonLabel: allow });
}

interface Context {
    id: string;
    url?: string;
    bundleId?: string;
}

/**
 * Switches Appium to the app's web page. The page's context changes id when a new page loads, so look it up each
 * time: the newest WEBVIEW context belonging to this app with a real page in it.
 */
async function switchToWebView(): Promise<void> {
    let lastError = 'no attempt finished';
    await browser
        .waitUntil(
            async () => {
                const contexts = (await driver.execute('mobile: getContexts', { waitForWebviewMs: 0 })) as Context[];
                const pages = contexts.filter(
                    (c) => c.id.startsWith('WEBVIEW') && (!c.bundleId || WEB_INSPECTOR_IDS.includes(c.bundleId)) && c.url && c.url !== 'about:blank',
                );
                const ours = pages[pages.length - 1];
                if (!ours) {
                    lastError = `contexts: ${JSON.stringify(contexts)}`;
                    return false;
                }
                try {
                    await driver.switchContext(ours.id);
                    return true;
                } catch (e) {
                    lastError = String(e);
                    return false;
                }
            },
            { timeout: 60_000, interval: 1_000 },
        )
        .catch(() => {
            throw new Error(`could not switch to the app's web page: ${lastError}`);
        });
}

/**
 * Runs `fn` inside the app's web page (the WEBVIEW context), then returns to the native screen.
 * `retries`: a read-only check may run again if the page changed under it (a new page load replaces the context).
 */
export async function inWebView<T>(fn: () => Promise<T>, options: { retries?: number } = {}): Promise<T> {
    await switchToWebView();
    try {
        for (let attempt = 0; ; attempt++) {
            try {
                return await fn();
            } catch (e) {
                if (attempt >= (options.retries ?? 0) || !/no such context|not connected|disconnected|no such window|page.*(changed|unload)/i.test(String(e))) throw e;
                await browser.pause(2_000);
                await driver.switchContext('NATIVE_APP');
                await switchToWebView();
            }
        }
    } finally {
        await driver.switchContext('NATIVE_APP');
    }
}

/**
 * Native locators. Order for native screens: the label VoiceOver reads (`byLabel`) for controls, in the screen's
 * language → the accessibility identifier (`~id`) for content and for controls whose label is plain text we assert on
 * → class chain only for system parts we don't own → never XPath.
 */
const quoted = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
export const byLabel = (label: string) => `-ios predicate string:label == ${quoted(label)}`;
export const byLabelContains = (text: string) => `-ios predicate string:label CONTAINS ${quoted(text)}`;
export const byId = (id: string) => `~${id}`;
