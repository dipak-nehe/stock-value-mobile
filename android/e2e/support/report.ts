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

/**
 * A video of each test: the emulator's own screen recorder (adb screenrecord, via Appium), attached to the test in
 * the Allure report. Android caps one recording at 3 minutes; longer tests keep their first 3 minutes.
 * Set E2E_VIDEO=0 to turn it off.
 */
const videoOn = () => process.env.E2E_VIDEO !== '0';

export async function startVideo(): Promise<void> {
    if (!videoOn()) return;
    try {
        await driver.startRecordingScreen({ timeLimit: 180, bitRate: 1_500_000, forceRestart: true } as object);
    } catch {
        // a missing video must never fail a test
    }
}

export async function attachVideo(name: string): Promise<void> {
    if (!videoOn()) return;
    try {
        const mp4 = await driver.stopRecordingScreen();
        if (mp4) allureReporter.addAttachment(name, Buffer.from(mp4, 'base64'), 'video/mp4');
    } catch {
        // the session may already be gone
    }
}
