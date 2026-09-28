import allureReporter from '@wdio/allure-reporter';
import { androidCapabilities } from './support/capabilities.js';
import { attachVideo, screenshot, startVideo } from './support/report.js';

/**
 * WebdriverIO + Appium (UiAutomator2) for the Android app.
 *   npm run test:mock   exact checks against a local mock of the web app (reached from the device via `adb reverse`)
 *   npm run test:live   a smoke test against https://stock-value-analysis.vercel.app
 * Needs a running emulator or USB-connected phone and the debug APK (`./gradlew assembleDebug` in the repo root).
 */
export const config: WebdriverIO.Config = {
    runner: 'local',
    tsConfigPath: './tsconfig.json',

    specs: ['./specs/**/*.e2e.ts'],
    suites: {
        mock: ['./specs/mock/**/*.e2e.ts'],
        live: ['./specs/live/**/*.e2e.ts'],
    },
    maxInstances: 1, // one device
    capabilities: [androidCapabilities],

    logLevel: 'warn',
    outputDir: './logs',
    bail: 0,
    // CI emulators are sometimes overloaded right after boot (Google Play services busy): re-run a failed spec file
    // once in a fresh session. A real failure fails twice and still fails the job; the retry shows in Allure.
    specFileRetries: process.env.CI ? 1 : 0,
    specFileRetriesDeferred: false,
    waitforTimeout: 20_000,
    connectionRetryTimeout: 180_000,
    connectionRetryCount: 2,

    services: [
        [
            'appium',
            {
                // The appium and uiautomator2 driver from this folder's node_modules.
                args: {
                    allowInsecure: 'uiautomator2:chromedriver_autodownload',
                    log: './logs/appium.log',
                },
            },
        ],
    ],

    framework: 'mocha',
    mochaOpts: {
        ui: 'bdd',
        timeout: 240_000,
    },

    reporters: [
        'spec',
        [
            'allure',
            {
                outputDir: 'allure-results',
                disableWebdriverStepsReporting: true,
                disableWebdriverScreenshotsReporting: true, // screenshots are attached explicitly, with names
                addConsoleLogs: true,
                reportedEnvironmentVars: {
                    Platform: 'Android',
                    Automation: 'Appium UiAutomator2',
                    Device: process.env.ANDROID_DEVICE_NAME ?? 'Android Emulator',
                },
            },
        ],
    ],

    // Every test gets a video and ends with a screenshot in the Allure report; failures also get the native screen's UI tree.
    beforeTest: async () => {
        await startVideo();
    },

    afterTest: async (test, _context, { passed }) => {
        await screenshot(`${passed ? 'screen after' : 'screen at failure'}: ${test.title}`);
        await attachVideo(`video: ${test.title}`);
        if (passed) return;
        try {
            await driver.switchContext('NATIVE_APP');
            allureReporter.addAttachment('native UI tree', await driver.getPageSource(), 'application/xml');
        } catch {
            // the session may already be gone
        }
    },
};
