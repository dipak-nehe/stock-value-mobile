# Test plan: 10-Year Stock Value Analysis apps (Android and iOS)

How the two native apps are tested: what is covered, at which level, on which devices and data, and what "done" means. The list of every end-to-end test is [e2e-tests.md](e2e-tests.md). The web app's own pages and data are tested in the [web app's repository](https://github.com/dipak-nehe/stock-trend-analyzer) ([its test plan](https://github.com/dipak-nehe/stock-trend-analyzer/blob/main/docs/test-plan.md)); here the web pages are tested only *inside* the apps.

**At a glance**

| | Android | iOS |
|---|---|---|
| Unit | 21 (JUnit, on the JVM) | 22 (XCTest) |
| Instrumented | 11 (Espresso, emulator) | launch check with screenshots |
| End-to-end | 34 (WebdriverIO + Appium UiAutomator2) | 34 (WebdriverIO + Appium XCUITest) |
| Where | GitHub Actions, Linux runner, Android emulator (API 34) | GitHub Actions, macOS runner, newest iPhone simulator |
| Time per full run | about 15 min | 30–60 min |

## 1. Scope

**In scope (both apps)**
- The web view shell: pages of the web app stay in the app, other sites open in the browser, unsafe links are blocked, Back, pull to refresh, the offline screen and *Try again*, the app identifying itself to the site.
- Filing alerts: the ☆ Watch button, the Watchlist, the rules for what gets announced (new annual/quarterly reports and serious 8-K events, each once, oldest first), background and *Check now* checks, notifications, and tapping a notification to open the company.
- Unknown tickers: the app won't watch a ticker SEC doesn't know, and a check drops one already on the list.
- English and Spanish, accessibility of the native screens (labels and touch-target sizes), and axe-core on the web pages inside the app.
- The API contract with the web app (the API version both must share).

**Out of scope here**
- The web app's numbers, rules and pages in a desktop browser (web repo).
- Real phones, app-store builds, other Android versions and device sizes beyond the CI emulator/simulator (see §9).
- Push notifications from a server (the apps use on-device checks and local notifications).

## 2. Risks the tests address

| Risk | Covered by |
|---|---|
| A link opens where it shouldn't (e.g. a lookalike site inside the app) | Link-policy unit tests on both platforms, browsing e2e tests |
| Alerts are missed, repeated or noisy | Alert-rule unit tests (baseline, once only, oldest first, letters and acquisitions never announced), Espresso check tests, e2e alert flow with a mock site |
| A notification opens the wrong page | Espresso (Android) and e2e tests that tap a real notification and check the page shown |
| An unknown ticker sits on the Watchlist forever | Espresso and e2e "won't watch a ticker SEC doesn't know" |
| Unusable without sight or with large fingers | Native accessibility checks (Android 48 dp, iOS 44 pt) and axe-core inside the app |
| Wrong language | Spanish suite: toolbar, Watchlist, a real notification, offline screen |
| The apps and the web app drift apart | API-version unit test, live-site e2e suite |

## 3. Test levels

| Layer | Android | iOS | What it proves |
|---|---|---|---|
| Unit | `android/app/src/test/` (21) | `ios/StockValueTests/` (22) | Link policy incl. lookalike hosts and blocked schemes, results-page detection, alert rules, reading the API response, saving (and capping) the watchlist, the API version |
| Instrumented | `android/app/src/androidTest/` (11, Espresso + Espresso-Web + WorkManager testing, against a local MockWebServer) | CI launch check: install, open, screenshot the start page, KO's results and Spanish | The shell loads, links route correctly, offline recovers; watching, checking and notifying work on a device |
| End-to-end, mock suite | `e2e/android/specs/mock/` (20) | `e2e/ios/specs/mock/` (20) | The installed app driven like a person, against a local copy of the web app whose "SEC filings" the tests change to trigger real notifications |
| End-to-end, live suite | `e2e/android/specs/live/` (14) | `e2e/ios/specs/live/` (14) | The installed app against https://stock-value-analysis.vercel.app with real SEC data: analysis, compare, every tab, a wrong ticker, axe-core, Spanish |

## 4. Environments and test data

- **Android:** GitHub `ubuntu-latest` with KVM, `ReactiveCircus/android-emulator-runner` (API 34, `google_apis`, x86_64), debug APK. The emulator's error dialogs are hidden and it gets a warm-up before tests.
- **iOS:** GitHub `macos-latest` (current Xcode), the newest available iPhone simulator (picked by `.github/scripts/pick_simulator.py`), a debug build (web page inspectable for Appium).
- **Mock web app** (`e2e/shared/mockSite.ts`): start page, a second page, a results page and `/api/financials` for KO; tests set its latest report and filing events. Android reaches it through `adb reverse`; the iOS simulator shares the Mac's network.
- **Live site:** the real web app and SEC data; these tests are read-only and kept few, because they depend on the network and on the site.
- **Launch options** (debug builds only): point the app at another site (`SITE_URL` / `-SiteURL`), open a page at launch (`OPEN_URL` / `-OpenURL`), language (Android per-app locale / iOS `-AppleLanguages`).

## 5. Approach and conventions

- **One framework for both apps:** WebdriverIO 9 + Appium 3 in TypeScript, Mocha, Allure. `e2e/shared/` holds the page objects for the web pages and the mock site, used unchanged by both platforms; each platform has its own native screen objects and specs.
- **Page objects only:** specs contain no selectors. Web content: accessible name (`aria/…`) → `data-testid` → `#id` when the name is incidental → never XPath. Native: Android content description / resource id; iOS accessibility label (`-ios predicate`) / accessibility identifier (`~id`); class chain only for system parts.
- **Evidence:** every test ends with a screenshot and has a video (Android: the emulator's recorder; iOS: `simctl` recording, shrunk with `avconvert`); failures add the native UI tree. iOS runs also upload the screenshots and notes as small files (`e2e-evidence`).
- **Fresh state per spec file:** the app is reset (Android: data cleared; iOS: reinstalled, which also clears notifications).
- **A spec file that fails is retried once on CI** (a busy emulator or simulator right after boot); a real failure fails twice, and retries are visible in the report.

## 6. Traceability: features and their tests

| Feature | Unit | Espresso (Android) | End-to-end (both) |
|---|---|---|---|
| Web view, links, Back | SitePolicy, SiteUrls | loads the site, links stay in the app, other sites and new tabs open outside | browsing, Back, user agent |
| Offline screen | — | offline screen recovers | offline screen, *Try again* |
| Watch ☆ and Watchlist | watchlist saved and capped | Watch shows only on a results page, starting point recorded | Watch star, Watchlist, stop watching |
| Alert rules | AlertRules (10 per platform) | a check alerts once for a report and a serious warning | new 10-Q and late-filing notice announced, SEC letter not |
| Notification tap | — | opens the company on its history tab | tapping a notification opens the analysis |
| Unknown tickers | — | refused when watching; dropped by a check | wrong ticker: error in view, app won't watch it |
| Web pages in the app | API response parsing, API version | — | live analysis, every tab, compare, Spanish |
| Spanish | — | — | toolbar, Watchlist, notification, offline screen |
| Accessibility | — | — | native labels and touch targets on every screen; axe-core on mock and live pages |

## 7. CI and reporting

- **One repository, two workflows** with path filters: `.github/workflows/android.yml` runs when `android/`, `e2e/android/` or `e2e/shared/` change; `ios.yml` for `ios/`, `e2e/ios/` or `e2e/shared/`.
- **Android jobs:** unit tests + lint + debug APK (artifact `stock-value-debug-apk`); Espresso on an emulator (report and logcat on failure); Appium end-to-end.
- **iOS jobs:** build + unit tests + launch screenshots (artifact `simulator-screenshots`); Appium end-to-end. *Run workflow* has a **spec** field to run a single spec file (about 10 minutes, unit job skipped).
- **Reports:** an Allure report per platform (artifact `appium-allure-report`), the pass count on the run's summary page, and the Appium logs on failure.

## 8. Entry and exit criteria

- **Before pushing:** Android `./gradlew testDebugUnitTest lintDebug assembleDebug` passes (from `android/`), and both e2e packages type-check (`npm run typecheck`). iOS compiles only on CI.
- **Done:** both workflows green; a new feature has a test on each platform where it applies; a bug fix includes a test that failed before.

## 9. Current status and known gaps

- **Android:** fully green (unit, Espresso, all 34 end-to-end tests) since the repositories were merged.
- **iOS:** unit tests and the launch check pass; the latest completed end-to-end run passed 32 of 34. Opening a notification from **Notification Center** on the iOS 26 simulator is still being solved: a synthesized tap doesn't open the app, while a swipe right does (it once opened the wrong card, since fixed). "Stop watching" depended on that test and was made independent. The notification itself (text, Spanish, one card per alert) is verified.
- **Devices:** one emulator image and one simulator; no real phones, tablets or older OS versions yet.
- **Background timing:** WorkManager (every 12 hours) and iOS background refresh (when iOS decides) are not time-tested; *Check now* runs the same code on demand.
- **Live tests** depend on the live site and SEC; they are kept read-only and few.
- **Android report publishing** to its own site is ready but waits for a `VERCEL_TOKEN` secret.

## 10. Running the tests

```bash
# Android (JDK 21): unit tests, lint, APK; Espresso needs an emulator
cd android && ./gradlew testDebugUnitTest lintDebug assembleDebug
./gradlew connectedDebugAndroidTest

# Android end-to-end: an emulator or phone connected, the debug APK built
cd e2e/android && npm ci && npm test          # or npm run test:mock / npm run test:live

# iOS (a Mac with Xcode): unit tests, then end-to-end on a simulator
cd ios && xcodegen generate && xcodebuild test -scheme StockValue -destination 'platform=iOS Simulator,name=iPhone 17' CODE_SIGNING_ALLOWED=NO
xcodebuild build -scheme StockValue -destination 'platform=iOS Simulator,name=iPhone 17' -derivedDataPath build CODE_SIGNING_ALLOWED=NO
cd ../e2e/ios && npm ci && npm test
```
