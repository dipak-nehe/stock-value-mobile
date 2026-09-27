# 10-Year Stock Value Analysis for Android

[![android](https://github.com/dipak-nehe/stock-value-android/actions/workflows/android.yml/badge.svg)](https://github.com/dipak-nehe/stock-value-android/actions/workflows/android.yml)

An Android app for [10-Year Stock Value Analysis](https://stock-value-analysis.vercel.app): ten years of a company's SEC filings, red flags, filing history, Graham & Buffett checklists and a side-by-side compare page. The app is a small native shell around a WebView, so it always shows the current version of the web app ([source](https://github.com/dipak-nehe/stock-trend-analyzer)) with no separate release needed for content changes.

## Filing alerts

The part the website can't do: **watch companies and get a notification when they file something that matters.**

- On a company's results page, tap the **☆** in the top bar to watch it (★ = watching). The **Watchlist** screen (list icon) shows each company's latest report and when it was last checked; tap one to open its analysis, ✕ to stop watching, or *Check now*.
- About twice a day, and only when online, the phone asks the web app's API about each watched company (up to 25) and posts a notification for:
  - **a new annual or quarterly report** (10-K, 10-Q, 20-F, 40-F or an amendment): "Filed a new 10-Q on 2026-07-29";
  - **a serious warning**: a restatement warning (8-K item 4.02), an auditor change (8-K item 4.01), a late-filing notice (NT 10-K / NT 10-Q) or an amended annual report.

  SEC review letters are recorded but not announced.
- Watching a company only records its current filings: you're told about what's filed from then on, never about old filings. Each filing is announced once.
- Tapping a notification opens the company's analysis; warnings open on the SEC history tab.
- No accounts and no server-side list: the watchlist is stored only on the phone, and the checks use the same cached API as the web page (usually a cache hit, so SEC isn't asked again). Android 13+ asks for notification permission the first time you watch a company.

How it works: `FilingChecks.kt` schedules a WorkManager job every 12 hours while anything is watched; `StatusApi.kt` reads `latestReport` and `secHistory.events` from `/api/financials`; `AlertRules` (in `Filings.kt`) decides what's new; `AlertNotifier.kt` posts the notification; `WatchStore.kt` keeps the list.

## What the app adds around the web page

- **Links go to the right place.** Pages of the web app stay inside the app. SEC filings, Google and Yahoo Finance, GitHub and other sites open in the phone's browser. Anything else (`javascript:`, `intent:`, `file:` links) is blocked. The rules live in `SitePolicy.kt` and are unit-tested.
- **Back button** goes back through the pages you visited, then leaves the app. Predictive back is supported on Android 13+.
- **Loading bar, pull to refresh** (only when the page is scrolled to the top), and an **offline screen** with a *Try again* button.
- **Recovers from WebView renderer crashes** (e.g. the system killing it to free memory) by restarting the screen instead of crashing the app.
- **Light and dark mode** follow the phone. The web page gets the matching `prefers-color-scheme`, and native colours match the site, so there's no flash while loading.
- **Edge to edge:** content sits between the status bar, navigation bar, notch and keyboard.
- **English and Spanish:** the web app follows the phone's language; the app's own few texts are translated too.
- **Keeps its place** on rotation and after the system recreates the screen.
- The app identifies itself to the site with `StockValueAndroid/<version>` added to the browser's user agent.

## Security and privacy

- HTTPS only (`network_security_config.xml`). Debug builds also allow plain HTTP to `127.0.0.1` and `localhost`, for the tests' local server.
- JavaScript is on because the web app needs it, but no JavaScript bridge into the app is exposed. File and content access are off, and mixed content is never loaded.
- Permissions: `INTERNET`, and `POST_NOTIFICATIONS` for filing alerts (asked for only when you first watch a company). Backups are off. Stored data: the watchlist (tickers and the filings already seen), the web app's language choice and the browser cache.
- The web app's privacy note applies: anonymous visit counts with Vercel Web Analytics, no cookies, no personal data.

## Build and run

Requirements: JDK 17+ (CI uses Temurin 21) and the Android SDK (`local.properties` with `sdk.dir=...`, or `ANDROID_HOME`).

```bash
./gradlew assembleDebug               # APK: app/build/outputs/apk/debug/app-debug.apk
./gradlew installDebug                # install on a connected phone or running emulator
./gradlew testDebugUnitTest           # unit tests (JVM, no device)
./gradlew lintDebug                   # Android Lint, warnings count as errors
./gradlew connectedDebugAndroidTest   # emulator/device tests
```

To install on a phone without Android Studio: download the **stock-value-debug-apk** artifact from the latest [Actions run](https://github.com/dipak-nehe/stock-value-android/actions), copy the APK to the phone, and open it (allow installing from that source when asked). Or with USB debugging on: `adb install app-debug.apk`.

## Tests

| Layer | Where | What it proves |
|---|---|---|
| **Unit** (JUnit, 20 tests) | `app/src/test/…` | `SitePolicyTest`: web-app pages stay in the app; other sites and mail open elsewhere; lookalike hosts, plain HTTP and other ports aren't the app; `javascript:`, `intent:`, `file:`, `content:` and malformed links are blocked. `AlertRulesTest`: the first check only records a starting point; new reports and serious warnings are announced once, oldest first; SEC letters and older reports aren't. `SiteUrlsTest`: which pages are a company's results. `JsonTest`: reading the API response and saving the watchlist |
| **Emulator** (Espresso + Espresso-Web + WorkManager testing, 10 tests) | `app/src/androidTest/…` | Against a local test server. `MainActivityTest`: the page loads and the user agent names the app; a link within the site stays in the app and Back returns; external and new-tab links go to the browser; the offline screen appears and *Try again* recovers. `WatchTest`: the Watch button shows only on a results page; watching records the starting point without alerts and shows in the Watchlist, where it can be removed; a check posts exactly the expected notifications once; an unknown ticker doesn't stop the others; a notification opens the company's page |
| **Lint** | `./gradlew lintDebug` | Android Lint with warnings as errors (version-update checks are left to Dependabot) |

GitHub Actions (`.github/workflows/android.yml`) runs three jobs on every push: unit tests, lint and the debug APK (uploaded); the Espresso tests on an Android 14 emulator; and the WebdriverIO + Appium suites on another emulator, with the Allure report uploaded.

## End-to-end tests (WebdriverIO + Appium)

`e2e/` is a TypeScript test framework that drives the installed app the way a person does, through **WebdriverIO 9**, **Appium 3** and the **UiAutomator2** driver, and writes an **Allure** report.

- **Hybrid:** steps switch between the native app (toolbar star, Watchlist, notification shade, offline screen, Back) and the page inside the WebView (`inWebView(...)` switches Appium to the `WEBVIEW_…` context; chromedriver is downloaded to match the device's WebView). Debug builds turn on WebView debugging for this.
- **Two suites (31 tests):**
  - `mock`: exact checks against a small local copy of the web app (`support/mockSite.ts`), reached from the device through `adb reverse`. The tests change its "SEC filings" to trigger a real notification, then tap it.
    - browsing and Back, the user agent, the offline screen and *Try again*;
    - the full watch → notification → open → unwatch flow;
    - **accessibility**: on every native screen (start, results, Watchlist with a company and empty, offline) each tappable control needs a screen-reader label and a 48dp touch target (`support/a11y.ts` reads the UI tree); the page inside the WebView is checked with **axe-core** (WCAG 2.1 A/AA);
    - **Spanish**: the app is switched to Spanish with Android 13+'s per-app language setting; toolbar, Watchlist, a real notification and the offline screen must be in Spanish.
  - `live`: against https://stock-value-analysis.vercel.app with real SEC data: loads the site, analyses KO, shows the Watch star, shows the site in Spanish inside the app, and runs axe-core on the live start and results pages. **Compare:** opens *Compare with another stock* inside the app with KO loaded, compares PEP (cards, key figures, chart), runs axe-core on the compare page, follows *Open full analysis* and Back (the Watch star appears on a company page and disappears on the comparison), and checks the comparison in Spanish.
- **Structure:** `wdio.conf.ts` (runner, Appium service, reporters, failure screenshots), `support/capabilities.ts` (Android/UiAutomator2 capabilities), `support/app.ts` (launch with intent extras, reset, adb, WebView switching, selectors), `screens/` (screen objects), `specs/mock/` and `specs/live/`.
- **Allure:** a named screenshot after every test (passed or failed) and at key steps (the notification shade with the alerts, the screens in Spanish), the accessibility findings as JSON, and the native UI tree on failure. CI uploads a single-file report as the **appium-allure-report** artifact.
- **CI stability:** the job frees disk space for the emulator, warms the device up before testing, and re-runs a failed spec file once (`specFileRetries`, CI only). A real failure fails twice and still fails the job.

Run locally (needs Node 20.19+, a running emulator or a USB-connected phone with USB debugging, and the Android SDK's `adb`):

```bash
./gradlew assembleDebug          # the APK the tests install
cd e2e
npm ci                           # WebdriverIO, Appium and the UiAutomator2 driver (local, nothing global)
npm run appium:drivers           # should list uiautomator2
npm run test:mock                # or: npm run test:live, npm run test:a11y, npm test (all)
npm run report && npm run report:open
```

Useful variables: `ANDROID_SERIAL` (pick a device), `APK_PATH` (another APK), `ANDROID_HOME` (where `adb` is).

## Test report email

After each push to `main`, and after any failed run, the last CI job emails a summary to the address in the `REPORT_EMAIL` repository variable (Settings → Secrets and variables → Actions → Variables). The email shows the result of each job, the end-to-end pass/fail counts (a retried test counts once, by its last attempt), a button to that run's **Allure report** on its own Vercel site, and a link to the GitHub run.

One-time setup (the values never appear in the code or the logs):

```bash
gh secret set SMTP_USERNAME -R dipak-nehe/stock-value-android   # the Gmail address that sends the email
gh secret set SMTP_PASSWORD -R dipak-nehe/stock-value-android   # a Gmail app password (Google Account → Security → App passwords)
gh secret set VERCEL_TOKEN  -R dipak-nehe/stock-value-android   # vercel.com/account/settings/tokens, whole account or team
```

Without the SMTP secrets the email is skipped with a note; without `VERCEL_TOKEN` the report isn't published and the button links to the GitHub run (the report is still downloadable there). The report site (`stock-value-android-test-report`) is public so the link opens on any device; it contains screenshots of the app and test pages only.

## Project structure

```
app/src/main/java/com/dipaknehe/stockvalue/
  MainActivity.kt        the screen: WebView setup, loading/offline/back handling, insets, crash recovery, Watch button
  WatchlistActivity.kt   the Watchlist screen
  FilingChecks.kt        scheduling and the background check (WorkManager)
  Filings.kt             alert data and AlertRules: what counts as new (pure Kotlin, unit-tested)
  StatusApi.kt           reads the web app's API
  AlertNotifier.kt       notifications
  WatchStore.kt, WatchCodec.kt   the watchlist, saved on the phone as JSON
  SitePolicy.kt, SiteUrls.kt     where each link opens; which pages are results pages (unit-tested)
app/src/main/res/        layout, English/Spanish strings, light/dark colours and theme, adaptive icon, network security
app/src/debug/res/xml/   debug-only network security config for the tests' local server
app/src/test/            JVM unit tests
app/src/androidTest/     emulator tests
gradle/libs.versions.toml  dependency versions
.github/scripts/         Allure result counts and report publishing (Vercel) for the email
e2e/                     WebdriverIO + Appium end-to-end tests (TypeScript) and Allure report
```

## Not included yet

- **Play Store release:** needs a signing key, a release build and a Google Play developer account ($25 one-time).
- **App Links** (opening `stock-value-analysis.vercel.app` links from other apps straight in this app): needs a signed release key and an `assetlinks.json` file on the website.

## License

MIT, see [LICENSE](LICENSE).
