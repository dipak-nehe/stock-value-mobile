# 10-Year Stock Value Analysis: Android and iOS apps

[![android](https://github.com/dipak-nehe/stock-value-mobile/actions/workflows/android.yml/badge.svg)](https://github.com/dipak-nehe/stock-value-mobile/actions/workflows/android.yml)
[![ios](https://github.com/dipak-nehe/stock-value-mobile/actions/workflows/ios.yml/badge.svg)](https://github.com/dipak-nehe/stock-value-mobile/actions/workflows/ios.yml)

Native Android (Kotlin) and iOS (Swift) apps for [10-Year Stock Value Analysis](https://stock-value-analysis.vercel.app): the web app in a web view, plus what a website can't do: a **watchlist that checks SEC filings in the background and sends notifications** about new annual or quarterly reports and serious warnings (restatement warnings, auditor changes, late filings, stock-exchange notices, cybersecurity incidents, large write-downs, bankruptcies). English and Spanish.

Both apps follow the same design and the same rules, and are tested the same way, down to one shared set of page objects for the web content.

## What's where

```
android/              Kotlin app (Gradle): WebView shell, watchlist, WorkManager checks, notifications
                      + JVM unit tests and Espresso tests                    → android/README.md
ios/                  Swift app (SwiftUI + WKWebView, XcodeGen project.yml): the same features
                      + XCTest unit tests                                      → ios/README.md
e2e/                  end-to-end tests: WebdriverIO + Appium, TypeScript, Allure reports
  shared/             used by both apps: page objects for the web app's pages, the local mock of
                      the web app, the language helper
  android/            UiAutomator2 driver: config, native screen objects, specs (own package.json)
  ios/                XCUITest driver: config, native screen objects, specs (own package.json)
.github/workflows/    android.yml (Linux + emulator), ios.yml (macOS + simulator)
.github/scripts/      simulator picker, Allure result counts, optional report publishing
```

Architecture with diagrams: [android/docs/architecture.md](android/docs/architecture.md) and [ios/docs/architecture.md](ios/docs/architecture.md).

## Tests

| | Android | iOS |
|---|---|---|
| Unit | 21 JVM tests | 22 XCTest tests |
| Instrumented | 12 Espresso tests | (launch check with screenshots) |
| End-to-end | 34 Appium tests (UiAutomator2) | 34 Appium tests (XCUITest) |

The end-to-end suites run against a local mock of the web app (exact checks: browsing, offline screen, watch → real notification → tap opens the company, Spanish, accessibility) and against the live site (analysis, compare, a tab tour, a wrong ticker). Every test gets a screenshot and a video in its Allure report.

## CI

Each workflow runs only when its app, its tests or the shared test code change (`android/**` or `ios/**`, `e2e/<platform>/**`, `e2e/shared/**`), and on demand from the Actions tab. Reports are artifacts on each run: **appium-allure-report** (end-to-end), **stock-value-debug-apk** (Android), **simulator-screenshots** (iOS). The repo is public, so GitHub's macOS runners are free.

## Running the end-to-end tests locally

```bash
# Android: an emulator or phone connected (adb devices), the debug APK built
(cd android && ./gradlew assembleDebug)
cd e2e/android && npm ci && npm test

# iOS: a Mac with Xcode and an iOS simulator
(cd ios && xcodegen generate && xcodebuild build -scheme StockValue -destination 'platform=iOS Simulator,name=iPhone 17' -derivedDataPath build CODE_SIGNING_ALLOWED=NO)
cd e2e/ios && npm ci && npm test
```

## History

This repository merges `stock-value-android` and `stock-value-ios` (now archived) with the full history of both.

## License

MIT, see [LICENSE](LICENSE).
