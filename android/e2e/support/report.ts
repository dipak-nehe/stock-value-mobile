import allureReporter from '@wdio/allure-reporter';

/** Attaches a screenshot of the whole device screen to the Allure report under `name`. */
export async function screenshot(name: string): Promise<void> {
    try {
        const png = await driver.takeScreenshot(); // native screenshot even inside the WebView (nativeWebScreenshot)
        allureReporter.addAttachment(name, Buffer.from(png, 'base64'), 'image/png');
    } catch {
        // a missing screenshot must never fail or hide a test result
    }
}

/** Attaches JSON (e.g. accessibility findings) to the Allure report. */
export function attachJson(name: string, value: unknown): void {
    allureReporter.addAttachment(name, JSON.stringify(value, null, 2), 'application/json');
}
