import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BUNDLE_ID = 'com.dipaknehe.stockvalue';

/**
 * How the app names itself to Web Inspector. iOS 26 simulators report the app's pages under its process
 * ("process-StockValue") rather than its bundle id, and Appium only offers pages from apps it can match.
 */
export const WEB_INSPECTOR_IDS = [BUNDLE_ID, 'process-StockValue'];

const here = fileURLToPath(new URL('.', import.meta.url));

/**
 * The simulator build of the app. CI builds it with `-derivedDataPath build`, which puts it here; set APP_PATH to use
 * another copy (e.g. one Xcode built into its own DerivedData). Debug builds accept the -SiteURL / -OpenURL launch
 * arguments and let Appium inspect the web page (isInspectable).
 */
export const APP = process.env.APP_PATH ?? resolve(here, '../../build/Build/Products/Debug-iphonesimulator/StockValue.app');

/**
 * Appium capabilities for the app on an iOS simulator.
 * Set IOS_UDID to pick a simulator (`xcrun simctl list devices`); otherwise Appium finds one by name and version.
 */
// Asserted rather than annotated: WebdriverIO's types don't list every XCUITest capability.
export const iosCapabilities = {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:deviceName': process.env.IOS_DEVICE_NAME ?? 'iPhone 17',
    ...(process.env.IOS_VERSION ? { 'appium:platformVersion': process.env.IOS_VERSION } : {}),
    ...(process.env.IOS_UDID ? { 'appium:udid': process.env.IOS_UDID } : {}),
    'appium:app': APP,
    'appium:bundleId': BUNDLE_ID,
    // Specs install and start the app themselves (support/app.ts), with or without the mock-server address.
    'appium:autoLaunch': false,
    'appium:newCommandTimeout': 240,
    // WebDriverAgent (the helper app Appium puts on the simulator) is built on the first session: minutes on CI.
    // A fixed build folder lets later sessions reuse it.
    'appium:derivedDataPath': resolve(here, '../../build/wda'),
    'appium:wdaLaunchTimeout': 300_000,
    'appium:wdaConnectionTimeout': 300_000,
    'appium:wdaStartupRetries': 2,
    'appium:simulatorStartupTimeout': 300_000,
    'appium:reduceMotion': true,
    'appium:connectHardwareKeyboard': false,
    // Hybrid testing: the page inside the app's WKWebView (inspectable in debug builds) is a WEBVIEW context.
    'appium:webviewConnectTimeout': 30_000,
    'appium:additionalWebviewBundleIds': WEB_INSPECTOR_IDS,
    'appium:fullContextList': true,
} as WebdriverIO.Capabilities;
