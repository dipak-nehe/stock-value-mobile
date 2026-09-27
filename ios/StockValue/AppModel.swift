import Foundation

/// Shared app state: the page on screen, pages to open (from notifications or the Watchlist), and the watchlist.
@MainActor
final class AppModel: ObservableObject {
    static let shared = AppModel()

    let store = WatchStore()
    let siteURL = AppInfo.siteURL

    /// The address currently shown in the web view (updates when the web app changes it, e.g. to ?t=KO).
    @Published var currentURL: String?
    /// A page to load next; the web view picks it up and clears it.
    @Published var pageToOpen: String?
    @Published private(set) var watchlist: [Watched] = []

    init() {
        refreshWatchlist()
        NotificationCenter.default.addObserver(forName: .watchlistChanged, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.refreshWatchlist() }
        }
    }

    /// The company on screen, if the page is a results page (the Watch star only shows then).
    var currentTicker: String? { SiteURLs.ticker(of: currentURL, siteURL: siteURL) }

    func isWatching(_ ticker: String) -> Bool { watchlist.contains { $0.ticker == ticker } }

    func refreshWatchlist() { watchlist = store.all() }

    /// Open a page of the web app (only pages of the site itself are accepted).
    func open(_ url: String) {
        guard SitePolicy(siteURL: siteURL).target(for: url) == .app else { return }
        pageToOpen = url
    }

    /// The ☆ button: watch the company on screen, or stop watching it. Returns a message to show.
    func toggleWatch() -> String? {
        guard let ticker = currentTicker else { return nil }
        let message: String
        if store.contains(ticker) {
            store.remove(ticker)
            message = String(format: String(localized: "unwatched"), ticker)
        } else if !store.add(ticker) {
            return String(format: String(localized: "watchlist_full"), WatchStore.max)
        } else {
            AlertNotifier.requestPermission()
            message = String(format: String(localized: "watched"), ticker)
            checkNow() // records today's filings as the starting point
        }
        FilingChecks.schedule()
        refreshWatchlist()
        return message
    }

    func remove(_ ticker: String) {
        store.remove(ticker)
        FilingChecks.schedule()
        refreshWatchlist()
    }

    func checkNow() {
        let site = siteURL
        Task.detached { await FilingChecks.run(siteURL: site) }
    }
}
