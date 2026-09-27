import allureReporter from '@wdio/allure-reporter';
import { iosCapabilities } from './support/capabilities.js';
import { screenshot, VideoRecorder } from './support/report.js';

/**
 * WebdriverIO + Appium (XCUITest) for the iOS app.
 *   npm run test:mock   exact checks against a local mock of the web app (the simulator reaches it as localhost)
 *   npm run test:live   smoke tests against https://stock-value-analysis.vercel.app
 * Needs Xcode with an iOS simulator, and the app built for it (see the README's "End-to-end tests").
 *
 * Every test gets a video and a final screenshot in the Allure report; failures also get the screen's UI tree.
 */
const video = new VideoRecorder('./logs/videos');

export const config: WebdriverIO.Config = {
    runner: 'local',
    tsConfigPath: './tsconfig.json',

    specs: ['./specs/**/*.e2e.ts'],
    suites: {
        mock: ['./specs/mock/**/*.e2e.ts'],
        live: ['./specs/live/**/*.e2e.ts'],
    },
    maxInstances: 1, // one simulator
    capabilities: [iosCapabilities],

    logLevel: 'warn',
    outputDir: './logs',
    bail: 0,
    // Re-run a failed spec file once in a fresh session on CI (a busy simulator right after boot); a real failure
    // fails twice and still fails the job, and the retry shows in Allure.
    specFileRetries: process.env.CI ? 1 : 0,
    specFileRetriesDeferred: false,
    waitforTimeout: 20_000,
    // The first session builds WebDriverAgent (several minutes on CI).
    connectionRetryTimeout: 600_000,
    connectionRetryCount: 2,

    services: [
        [
            'appium',
            {
                // The appium and XCUITest driver from this folder's node_modules.
                args: { log: './logs/appium.log' },
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
                    Platform: 'iOS',
                    Automation: 'Appium XCUITest',
                    Device: process.env.IOS_DEVICE_NAME ?? 'iPhone Simulator',
                },
            },
        ],
    ],

    beforeTest: async (test) => {
        const caps = driver.capabilities as Record<string, unknown>;
        await video.start(String(caps.udid ?? caps['appium:udid'] ?? process.env.IOS_UDID ?? ''), test.title);
    },

    afterTest: async (test, _context, { passed }) => {
        await screenshot(`${passed ? 'screen after' : 'screen at failure'}: ${test.title}`);
        await video.stopAndAttach(`video: ${test.title}`);
        // A test that failed inside Notification Center would leave lookups pointed at SpringBoard.
        await driver.updateSettings({ defaultActiveApplication: 'auto' }).catch(() => undefined);
        if (passed) return;
        try {
            await driver.switchContext('NATIVE_APP');
            allureReporter.addAttachment('native UI tree', await driver.getPageSource(), 'application/xml');
        } catch {
            // the session may already be gone
        }
    },
};
