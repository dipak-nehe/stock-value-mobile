import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_ID = 'com.dipaknehe.stockvalue';
export const MAIN_ACTIVITY = `${APP_ID}/.MainActivity`;

const here = fileURLToPath(new URL('.', import.meta.url));

/** The debug APK built by `./gradlew assembleDebug` (debug builds allow the mock server and WebView inspection). */
export const APK = process.env.APK_PATH ?? resolve(here, '../../app/build/outputs/apk/debug/app-debug.apk');

/**
 * Appium capabilities for the app on an Android emulator or a USB-connected phone.
 * Set ANDROID_SERIAL to pick a device when several are connected (`adb devices`).
 */
// Asserted rather than annotated: WebdriverIO's types don't list every UiAutomator2 capability (e.g. chromedriverAutodownload).
export const androidCapabilities = {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': process.env.ANDROID_DEVICE_NAME ?? 'Android Emulator',
    ...(process.env.ANDROID_SERIAL ? { 'appium:udid': process.env.ANDROID_SERIAL } : {}),
    'appium:app': APK,
    'appium:appPackage': APP_ID,
    'appium:appActivity': '.MainActivity',
    // Specs start the app themselves (with or without the mock-server address), so don't launch it at session start.
    'appium:autoLaunch': false,
    // Grants the runtime permissions the app asks for, including notifications (Android 13+).
    'appium:autoGrantPermissions': true,
    'appium:noReset': false,
    'appium:disableWindowAnimation': true,
    'appium:newCommandTimeout': 240,
    'appium:adbExecTimeout': 60_000,
    'appium:uiautomator2ServerInstallTimeout': 120_000,
    'appium:uiautomator2ServerLaunchTimeout': 120_000,
    // Hybrid testing: download the chromedriver that matches the device's WebView when switching to WEBVIEW.
    'appium:chromedriverAutodownload': true,
    'appium:ensureWebviewsHavePages': true,
    // A fresh chromedriver session on every switch into the WebView (the app's pages change between switches).
    'appium:recreateChromeDriverSessions': true,
    'appium:showChromedriverLog': true,
    'appium:nativeWebScreenshot': true,
} as WebdriverIO.Capabilities;
