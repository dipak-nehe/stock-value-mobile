# 10-Year Stock Value Analysis for Android

[![android](https://github.com/dipak-nehe/stock-value-android/actions/workflows/android.yml/badge.svg)](https://github.com/dipak-nehe/stock-value-android/actions/workflows/android.yml)

An Android app for [10-Year Stock Value Analysis](https://stock-value-analysis.vercel.app): ten years of a company's SEC filings, red flags, filing history, Graham & Buffett checklists and a side-by-side compare page. The app is a small native shell around a WebView, so it always shows the current version of the web app ([source](https://github.com/dipak-nehe/stock-trend-analyzer)) with no separate release needed for content changes.

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
- The only permission is `INTERNET`. Backups are off; the only stored data is the web app's language choice and the browser cache.
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
| **Unit** (JUnit, 4 tests) | `app/src/test/…/SitePolicyTest.kt` | Web-app pages stay in the app (any path, query, case, explicit port); other sites and mail open elsewhere; lookalike hosts, plain HTTP and other ports aren't treated as the app; `javascript:`, `intent:`, `file:`, `content:` and malformed links are blocked |
| **Emulator** (Espresso + Espresso-Web, 5 tests) | `app/src/androidTest/…/MainActivityTest.kt` | Against a local test server: the page loads and the user agent names the app; a link within the site stays in the app and Back returns; external and new-tab links send a browser intent instead of navigating; the offline screen appears when the server drops the connection and *Try again* recovers |
| **Lint** | `./gradlew lintDebug` | Android Lint with warnings as errors (version-update checks are left to Dependabot) |

GitHub Actions (`.github/workflows/android.yml`) runs the unit tests, lint and a debug build on every push, uploads the APK, and runs the emulator tests on an Android 14 emulator.

## Project structure

```
app/src/main/java/com/dipaknehe/stockvalue/
  MainActivity.kt        the screen: WebView setup, loading/offline/back handling, insets, crash recovery
  SitePolicy.kt          where each link opens (pure Kotlin, unit-tested)
app/src/main/res/        layout, English/Spanish strings, light/dark colours and theme, adaptive icon, network security
app/src/debug/res/xml/   debug-only network security config for the tests' local server
app/src/test/            JVM unit tests
app/src/androidTest/     emulator tests
gradle/libs.versions.toml  dependency versions
```

## Not included yet

- **Play Store release:** needs a signing key, a release build and a Google Play developer account ($25 one-time).
- **App Links** (opening `stock-value-analysis.vercel.app` links from other apps straight in this app): needs a signed release key and an `assetlinks.json` file on the website.

## License

MIT, see [LICENSE](LICENSE).
