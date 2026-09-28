import SwiftUI

// The app's screens, written in SwiftUI: each `View` describes what to show for the current state, and SwiftUI
// redraws it when that state changes.
//
// WHERE TO CHANGE THINGS:
//  - toolbar buttons: the `.toolbar { … }` block in RootView
//  - the offline screen: OfflineView; the Watchlist: WatchlistView
//  - texts: en.lproj/Localizable.strings and es.lproj/Localizable.strings (Text("key") looks the key up there)
//  - accessibility identifiers ("watch-button", …) are what the end-to-end tests find; keep them stable

/// The main screen: the web app, with the Watch star, the Watchlist button and Back in the toolbar.
struct RootView: View {
    // Swift notes: @EnvironmentObject = shared state handed down from the app (AppModel);
    // @StateObject = an object this view creates once and keeps; @State = small values owned by this view.
    // Changing any of them redraws the view.
    @EnvironmentObject var model: AppModel
    @StateObject private var web = WebController(model: AppModel.shared)
    @State private var showWatchlist = false
    @State private var toast: String? // a short message shown for 3 s (e.g. "Watching KO…")

    var body: some View {
        NavigationStack {
            // ZStack layers views on top of each other: the web page, then (when needed) the offline panel,
            // the loading bar and the toast.
            ZStack(alignment: .top) {
                WebView(controller: web)
                    .opacity(web.failed ? 0 : 1)
                if web.failed {
                    OfflineView { web.reload() }
                }
                if web.isLoading {
                    ProgressView(value: web.progress)
                        .progressViewStyle(.linear)
                        .accessibilityHidden(true)
                }
                if let toast {
                    Text(toast)
                        .font(.footnote)
                        .padding(10)
                        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 10))
                        .padding(.top, 8)
                        .accessibilityIdentifier("toast")
                }
            }
            .navigationTitle(Text("app_name"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                // Left: Back (only when the page has history). Right: the Watch star (only on a company's page)
                // and the Watchlist button.
                ToolbarItem(placement: .topBarLeading) {
                    if web.canGoBack {
                        Button { web.goBack() } label: { Image(systemName: "chevron.backward").frame(minWidth: 44, minHeight: 44) }
                            .accessibilityLabel(Text("back"))
                            .accessibilityIdentifier("back-button")
                    }
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    if let ticker = model.currentTicker {
                        let watching = model.isWatching(ticker)
                        Button {
                            show(model.toggleWatch())
                        } label: {
                            Image(systemName: watching ? "star.fill" : "star")
                                .frame(minWidth: 44, minHeight: 44) // Apple's minimum touch target
                        }
                        .accessibilityLabel(String(format: String(localized: watching ? "action_watching" : "action_watch"), ticker))
                        .accessibilityIdentifier(watching ? "watching-button" : "watch-button")
                    }
                    Button { showWatchlist = true } label: { Image(systemName: "list.bullet").frame(minWidth: 44, minHeight: 44) }
                        .accessibilityLabel(Text("watchlist"))
                        .accessibilityIdentifier("watchlist-button")
                }
            }
            // `$showWatchlist` passes a binding: the Watchlist opens when it's true and sets it back when closed.
            .navigationDestination(isPresented: $showWatchlist) { WatchlistView() }
        }
        // First appearance: open the requested page (debug launch argument) or the site's start page.
        .onAppear {
            web.load(AppInfo.launchPage.flatMap { SitePolicy(siteURL: model.siteURL).target(for: $0) == .app ? $0 : nil } ?? model.siteURL)
        }
        // A notification or the Watchlist asked for a page: go back to the web view and load it.
        .onChange(of: model.pageToOpen) { _, page in
            guard let page else { return }
            showWatchlist = false
            web.load(page)
            model.pageToOpen = nil
        }
    }

    /// Show a short message for 3 seconds. `guard let x else { return }` leaves early when x is nil.
    private func show(_ message: String?) {
        guard let message else { return }
        toast = message
        Task {
            try? await Task.sleep(for: .seconds(3))
            if toast == message { toast = nil }
        }
    }
}

/// Shown when the site can't be reached.
struct OfflineView: View {
    let retry: () -> Void // what "Try again" does (passed in by RootView: reload the page)

    var body: some View {
        VStack(spacing: 12) {
            Text("offline_title")
                .font(.title2.bold())
                .accessibilityIdentifier("offline-title")
            Text("offline_message")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Button(action: retry) { Text("retry").frame(minWidth: 120, minHeight: 44) }
                .buttonStyle(.borderedProminent)
                .accessibilityIdentifier("retry-button")
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemBackground))
    }
}

/// The Watchlist: each watched company with its latest report and last check; tap to open, remove, Check now.
struct WatchlistView: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        List {
            // First section: the explanation and "Check now". Second: the companies (or the empty message).
            Section {
                Text("watchlist_intro")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .accessibilityIdentifier("watchlist-intro")
                Button { model.checkNow() } label: { Text("check_now") }
                    .disabled(model.watchlist.isEmpty)
                    .accessibilityIdentifier("check-now-button")
            }
            Section {
                if model.watchlist.isEmpty {
                    Text("watchlist_empty").accessibilityIdentifier("watchlist-empty")
                }
                // One row per company; `id: \.ticker` tells SwiftUI which row is which when the list changes.
                ForEach(model.watchlist, id: \.ticker) { w in
                    HStack {
                        Button { model.open(SiteURLs.results(siteURL: model.siteURL, ticker: w.ticker)) } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(w.name.map { "\($0) (\(w.ticker))" } ?? w.ticker).font(.headline)
                                Text(detail(w)).font(.subheadline).foregroundStyle(.secondary)
                            }
                        }
                        .accessibilityIdentifier("row-\(w.ticker)")
                        Spacer()
                        // The 44 pt frame goes on the label, inside the button: framing the button from outside
                        // leaves only the small icon tappable. contentShape makes the empty area tappable too.
                        Button { model.remove(w.ticker) } label: {
                            Image(systemName: "xmark")
                                .frame(minWidth: 44, minHeight: 44)
                                .contentShape(Rectangle())
                        }
                            .buttonStyle(.borderless)
                            .accessibilityLabel(String(format: String(localized: "remove_ticker"), w.ticker))
                            .accessibilityIdentifier("remove-\(w.ticker)")
                    }
                }
            }
        }
        .navigationTitle(Text("watchlist"))
        .onAppear { model.refreshWatchlist() }
    }

    // "Latest report: 10-Q filed 2026-07-29" and "Checked 3 hours ago".
    private func detail(_ w: Watched) -> String {
        let report = w.report.map { String(format: String(localized: "latest_report"), $0.form, $0.date) }
            ?? String(localized: w.baselined ? "no_report" : "waiting_first_check")
        guard let checked = w.lastChecked else { return report }
        let relative = RelativeDateTimeFormatter().localizedString(for: checked, relativeTo: Date())
        return report + "\n" + String(format: String(localized: "last_checked"), relative)
    }
}
