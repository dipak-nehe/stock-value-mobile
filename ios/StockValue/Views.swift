import SwiftUI

/// The main screen: the web app, with the Watch star, the Watchlist button and Back in the toolbar.
struct RootView: View {
    @EnvironmentObject var model: AppModel
    @StateObject private var web = WebController(model: AppModel.shared)
    @State private var showWatchlist = false
    @State private var toast: String?

    var body: some View {
        NavigationStack {
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
                ToolbarItem(placement: .topBarLeading) {
                    if web.canGoBack {
                        Button { web.goBack() } label: { Image(systemName: "chevron.backward") }
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
                        }
                        .accessibilityLabel(String(format: String(localized: watching ? "action_watching" : "action_watch"), ticker))
                        .accessibilityIdentifier(watching ? "watching-button" : "watch-button")
                    }
                    Button { showWatchlist = true } label: { Image(systemName: "list.bullet") }
                        .accessibilityLabel(Text("watchlist"))
                        .accessibilityIdentifier("watchlist-button")
                }
            }
            .navigationDestination(isPresented: $showWatchlist) { WatchlistView() }
        }
        .onAppear {
            web.load(AppInfo.launchPage.flatMap { SitePolicy(siteURL: model.siteURL).target(for: $0) == .app ? $0 : nil } ?? model.siteURL)
        }
        .onChange(of: model.pageToOpen) { _, page in
            guard let page else { return }
            showWatchlist = false
            web.load(page)
            model.pageToOpen = nil
        }
    }

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
    let retry: () -> Void

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
                        Button { model.remove(w.ticker) } label: { Image(systemName: "xmark") }
                            .buttonStyle(.borderless)
                            .frame(minWidth: 44, minHeight: 44)
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
