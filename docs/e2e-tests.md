# End-to-end tests: Android and iOS apps

Every end-to-end test of the two apps, by spec file. They drive the installed debug app on a device the way a person does, with WebdriverIO + Appium (UiAutomator2 on an Android emulator, XCUITest on an iOS simulator), and switch into the app's web view for the web pages. Each test has a screenshot and a video in its platform's Allure report (the `appium-allure-report` artifact of each CI run). How these fit with the unit and instrumented tests: [test-plan.md](test-plan.md).

**34 Android + 34 iOS tests in 9 spec files each**, the same scenarios on both platforms. The *mock* suite runs against a local copy of the web app (`e2e/shared/mockSite.ts`) whose filings the tests change; the *live* suite runs against https://stock-value-analysis.vercel.app with real SEC data. The web page objects in `e2e/shared/webpages/` are shared by both platforms.

Run one platform with `cd e2e/android && npm test` or `cd e2e/ios && npm test`; one suite with `npm run test:mock` / `npm run test:live`; one file with `npx wdio run wdio.conf.ts --spec ./specs/mock/offline.e2e.ts`. On GitHub, the iOS workflow's *Run workflow* button takes a spec file too.

## Mock suite: exact checks against a local copy of the web app

### Browsing the web app inside the app (`specs/mock/navigation.e2e.ts`, 3)

The web app inside the app: toolbar, the site's user agent, links and Back.

| # | Test | Platforms |
|---|---|---|
| 1 | shows the site in the WebView with the Watchlist action and no Watch star on the start page | Android |
|  | shows the site in the web view with the Watchlist button and no Watch star on the start page | iOS |
| 2 | identifies itself to the site as the Android app | Android |
|  | identifies itself to the site as the iOS app | iOS |
| 3 | keeps links within the site in the app, and Back returns to the previous page | Android, iOS |

### Offline screen (`specs/mock/offline.e2e.ts`, 2)

The offline screen when the site can't be reached, and recovery.

| # | Test | Platforms |
|---|---|---|
| 4 | explains the problem when the site can't be reached | Android, iOS |
| 5 | loads the page after "Try again" once the site is reachable | Android, iOS |

### Filing alerts (`specs/mock/watch-alerts.e2e.ts`, 5)

The filing-alert flow with the mock site's "SEC filings" changed by the test: watch, Check now, real notifications, tap, stop watching.

| # | Test | Platforms |
|---|---|---|
| 6 | offers a Watch star on a company's results page | Android, iOS |
| 7 | watching records the current filings as the starting point, without a notification | Android, iOS |
| 8 | notifies about a new quarterly report and a late-filing notice | Android, iOS |
| 9 | tapping a notification opens the company's analysis | Android, iOS |
| 10 | can stop watching from the Watchlist | Android, iOS |

### Spanish (per-app language) (`specs/mock/translation.e2e.ts`, 4)

The app switched to Spanish (Android per-app language, iOS launch language).

| # | Test | Platforms |
|---|---|---|
| 11 | labels the toolbar actions in Spanish | Android, iOS |
| 12 | shows the Watchlist in Spanish | Android, iOS |
| 13 | sends the filing alert in Spanish | Android, iOS |
| 14 | shows the empty Watchlist and the offline screen in Spanish | Android, iOS |

### Accessibility (`specs/mock/accessibility.e2e.ts`, 6)

Every native screen: each control has a spoken label and a large enough touch target (Android 48 dp, iOS 44 pt); axe-core on the page inside the app.

| # | Test | Platforms |
|---|---|---|
| 15 | start screen: native controls are labelled and large enough | Android, iOS |
| 16 | the page inside the WebView passes axe-core | Android |
|  | the page inside the web view passes axe-core | iOS |
| 17 | results screen with the Watch star | Android, iOS |
| 18 | Watchlist with a company | Android, iOS |
| 19 | empty Watchlist | Android, iOS |
| 20 | offline screen | Android, iOS |

## Live suite: the real site and real SEC data

### Live site smoke test (`specs/live/smoke.e2e.ts`, 3)

The real site with real SEC data inside the app.

| # | Test | Platforms |
|---|---|---|
| 21 | loads the live web app and analyses a company from real SEC data | Android, iOS |
| 22 | offers the Watch star for that company | Android, iOS |
| 23 | shows the web app in Spanish inside the app | Android, iOS |

### Compare two stocks in the app (live site) (`specs/live/compare.e2e.ts`, 6)

The compare page inside the app: stays in the app, the Watch star follows the page, Spanish.

| # | Test | Platforms |
|---|---|---|
| 24 | opens the compare page inside the app with the first company loaded | Android, iOS |
| 25 | compares a second company from real SEC data | Android, iOS |
| 26 | the compare page passes axe-core inside the app | Android, iOS |
| 27 | "Open full analysis" stays in the app and brings back the Watch star | Android, iOS |
| 28 | Back returns to the comparison, and the star goes away again | Android |
|  | ‹ Back returns to the comparison, and the star goes away again | iOS |
| 29 | shows the comparison in Spanish inside the app | Android, iOS |

### Live site in the app: every tab, and a wrong ticker (`specs/live/tabs-and-errors.e2e.ts`, 3)

The web app's own tab tour and wrong-ticker checks, repeated inside the app, plus the app refusing to watch an unknown ticker.

| # | Test | Platforms |
|---|---|---|
| 30 | opens each tab on its own, with its content | Android, iOS |
| 31 | shows a wrong ticker's error where you can see it, and forgets the previous company | Android, iOS |
| 32 | won't watch a ticker SEC doesn't know | Android, iOS |

### Live site accessibility (`specs/live/accessibility.e2e.ts`, 2)

axe-core (WCAG 2.1 A/AA) on the live start and results pages inside the app.

| # | Test | Platforms |
|---|---|---|
| 33 | the start page passes axe-core inside the app | Android, iOS |
| 34 | a results page passes axe-core inside the app | Android, iOS |

## Where the platforms differ

- **Back:** Android's system Back button; iOS's ‹ button in the app's toolbar.
- **Notifications:** Android's notification shade; iOS's Notification Center (opened by swiping down from the top-left; a notification is opened by swiping it to the right).
- **Language:** Android 13+ per-app language setting; iOS launch arguments (`-AppleLanguages (es)`).
- **Touch targets:** Android 48 dp; iOS 44 pt (navigation-bar buttons: width only, because iOS makes the whole bar height tappable).
- **Reaching the mock site:** Android through `adb reverse`; the iOS simulator uses the Mac's `localhost` directly.
- **Known issue (iOS):** opening a notification from Notification Center on the iOS 26 simulator isn't reliable yet; see the test plan's current status.
