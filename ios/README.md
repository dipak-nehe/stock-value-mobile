# 10-Year Stock Value Analysis for iOS

[![ios](https://github.com/dipak-nehe/stock-value-ios/actions/workflows/ios.yml/badge.svg)](https://github.com/dipak-nehe/stock-value-ios/actions/workflows/ios.yml)

An iPhone and iPad app for [10-Year Stock Value Analysis](https://stock-value-analysis.vercel.app): ten years of a company's SEC filings, red flags, filing history, Graham & Buffett checklists and a compare page. Like its [Android sibling](https://github.com/dipak-nehe/stock-value-android), it's a small native shell around the web app, plus what a website can't do: a **watchlist with filing alerts**.

## What it does

- **The web app in a WKWebView**, always current with the site. Pages of the web app stay in the app; SEC filings, Google/Yahoo Finance and GitHub open in Safari; anything else (`javascript:`, `file:`, `tel:`) is blocked. New-tab links follow the same rules (`SitePolicy.swift`, unit-tested).
- **Back** (swipe from the edge, or the ‹ button), **pull to refresh**, a loading bar, an **offline screen** with *Try again*, and recovery if the page's renderer is killed.
- **Filing alerts:** tap the ☆ on a company's page to watch it (★ = watching). The **Watchlist** shows each company's latest report and last check, with *Check now* and ✕ to stop watching. A check asks the web app's cached API about each company and notifies about **new annual or quarterly reports** and **serious warnings** (restatement warnings, auditor changes, late-filing notices, amended annual reports). The first check only records the starting point; each filing is announced once; tapping a notification opens the company (warnings on the SEC history tab).
- **Background checks:** iOS runs them when it chooses (`BGAppRefreshTask`), typically a few times a day for apps you use and less on low battery, so alerts are less punctual than on Android. *Check now* always runs immediately.
- **English and Spanish**, light and dark mode. The watchlist stays on the phone; no accounts.

## Build and run

You need a Mac with **Xcode** (iOS 17+ SDK) and [XcodeGen](https://github.com/yonaskolb/XcodeGen), which generates the Xcode project from `project.yml`:

```bash
brew install xcodegen
xcodegen generate          # writes StockValue.xcodeproj
open StockValue.xcodeproj  # then run on a simulator (⌘R) or test (⌘U)
```

From the command line: `xcodebuild test -project StockValue.xcodeproj -scheme StockValue -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGNING_ALLOWED=NO`.

Running on your own iPhone needs an Apple ID in Xcode (free, 7-day signing); TestFlight and the App Store need an Apple Developer account.

## Tests

| Layer | Where | What it proves |
|---|---|---|
| **Unit** (XCTest) | `StockValueTests/` | The same cases as the Android unit tests: link rules (incl. lookalike hosts, plain http, blocked schemes), results-page detection, alert rules (baseline, once-only, oldest first, letters ignored), reading the API response, saving and capping the watchlist, the API version contract |

GitHub Actions (`.github/workflows/ios.yml`) generates the project, picks an available iPhone simulator on GitHub's macOS runner, builds, and runs the tests on every push.

## Project structure

```
project.yml                  XcodeGen project (targets, Info.plist, background task id, local-network exception)
StockValue/
  StockValueApp.swift        app entry; AppDelegate registers the background check and handles notification taps
  Views.swift                RootView (web view + toolbar), OfflineView, WatchlistView
  WebController.swift        the WKWebView: link routing, new-tab links, refresh, offline, Back
  AppModel.swift             shared state: page on screen, pages to open, the watchlist
  SitePolicy.swift, SiteURLs.swift   where links open; which pages are a company's results (pure, unit-tested)
  Filings.swift              alert data and AlertRules (pure, unit-tested)
  StatusAPI.swift            reads the web app's API
  FilingChecks.swift         background and on-demand checks
  AlertNotifier.swift        local notifications
  WatchStore.swift           the watchlist (UserDefaults, JSON)
  en.lproj/, es.lproj/       English and Spanish texts
StockValueTests/             unit tests
```

## Changing common things

| To change | Edit |
|---|---|
| The website | `SiteURL` in `project.yml` |
| Which filings alert | `AlertRules.serious` in `Filings.swift` (+ text in `AlertNotifier.warningText` and `Localizable.strings`) |
| How often iOS is asked to check | `FilingChecks.interval` |
| The most companies you can watch | `WatchStore.max` |
| Texts | `StockValue/en.lproj/Localizable.strings`, `StockValue/es.lproj/Localizable.strings` |
| Which links open in the app | `SitePolicy.swift` |

## License

MIT, see [LICENSE](LICENSE).
