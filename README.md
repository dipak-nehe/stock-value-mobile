# 10-Year Stock Value Analysis: Android and iOS apps

[![android](https://github.com/dipak-nehe/stock-value-mobile/actions/workflows/android.yml/badge.svg)](https://github.com/dipak-nehe/stock-value-mobile/actions/workflows/android.yml)
[![ios](https://github.com/dipak-nehe/stock-value-mobile/actions/workflows/ios.yml/badge.svg)](https://github.com/dipak-nehe/stock-value-mobile/actions/workflows/ios.yml)

Native Android (Kotlin) and iOS (Swift) apps for [10-Year Stock Value Analysis](https://stock-value-analysis.vercel.app): the web app in a web view, plus what a website can't do: a **watchlist that checks SEC filings in the background and sends notifications** about new annual or quarterly reports and serious warnings (restatement warnings, auditor changes, late filings, stock-exchange notices, cybersecurity incidents, large write-downs, bankruptcies). English and Spanish.

Every page of the web app opens inside the apps (results, compare, My portfolio, the S&P 500 picker, How we calculate). The web app's **Download CSV** buttons hand the file to the app, which opens the phone's share sheet (save to Files or Drive, email it, open it in a spreadsheet app): a web view can't save downloads by itself. On Android this is the only bridge the page can call, and both apps answer only pages of the web app.

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
Jenkinsfile           the same builds and tests on Jenkins (Android and iOS in parallel)  → docs/jenkins.md
jenkins/              Jenkins helper: start and stop a headless Android emulator
```

Architecture with diagrams: [android/docs/architecture.md](android/docs/architecture.md) and [ios/docs/architecture.md](ios/docs/architecture.md).

## Tests

| | Android | iOS |
|---|---|---|
| Unit | 24 JVM tests | 25 XCTest tests |
| Instrumented | 11 Espresso tests | (launch check with screenshots) |
| End-to-end | 34 Appium tests (UiAutomator2) | 34 Appium tests (XCUITest) |

**[Test plan](docs/test-plan.md)** (scope, layers, devices, traceability, exit criteria, current status) and **[every end-to-end test](docs/e2e-tests.md)**, side by side for both platforms.

The end-to-end suites run against a local mock of the web app (exact checks: browsing, offline screen, watch → real notification → tap opens the company, Spanish, accessibility) and against the live site (analysis, compare, a tab tour, a wrong ticker). Every test gets a screenshot and a video in its Allure report.

## CI

Each workflow runs only when its app, its tests or the shared test code change (`android/**` or `ios/**`, `e2e/<platform>/**`, `e2e/shared/**`), and on demand from the Actions tab. Reports are artifacts on each run: **appium-allure-report** (end-to-end), **stock-value-debug-apk** (Android), **simulator-screenshots** (iOS). The repo is public, so GitHub's macOS runners are free.

### Jenkins

[`Jenkinsfile`](Jenkinsfile) runs the same builds and tests on a Jenkins server: Android on an agent labelled `android`, iOS on one labelled `macos && xcode`, in parallel. Every build runs the unit tests, lint and both app builds; ticking **DEVICE_TESTS** adds the emulator and simulator tests and the Appium suites. Agents, plugins and how to create the job: [docs/jenkins.md](docs/jenkins.md).

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
