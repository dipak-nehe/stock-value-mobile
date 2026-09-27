import BackgroundTasks
import Foundation

/// Background filing checks. iOS runs a refresh task when it chooses (usually a few times a day for apps people use,
/// less on low battery); "Check now" runs one immediately.
///
/// TO CHANGE HOW OFTEN IOS IS ASKED TO CHECK: edit `interval` (iOS treats it as "not before", not a schedule).
enum FilingChecks {
    static let taskID = "com.dipaknehe.stockvalue.filing-check"
    static let interval: TimeInterval = 12 * 60 * 60

    /// Called once at app launch (before the app finishes launching).
    static func register() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: taskID, using: nil) { task in
            guard let refresh = task as? BGAppRefreshTask else { task.setTaskCompleted(success: false); return }
            schedule() // ask for the next one
            let work = Task { await run(siteURL: AppInfo.siteURL) }
            refresh.expirationHandler = { work.cancel() }
            Task {
                _ = await work.value
                refresh.setTaskCompleted(success: true)
            }
        }
    }

    /// Ask iOS for a background check (only while something is watched).
    static func schedule() {
        guard !WatchStore().all().isEmpty else {
            BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: taskID)
            return
        }
        let request = BGAppRefreshTaskRequest(identifier: taskID)
        request.earliestBeginDate = Date(timeIntervalSinceNow: interval)
        try? BGTaskScheduler.shared.submit(request) // fails in the simulator's background mode; checks still run via Check now
    }

    /// One check: asks the web app about each watched company and posts a notification for anything new.
    @discardableResult
    static func run(siteURL: String, store: WatchStore = WatchStore(), notifier: AlertNotifier = AlertNotifier()) async -> Bool {
        let api = StatusAPI(siteURL: siteURL)
        var failed = false
        for watched in store.all() {
            if Task.isCancelled { break }
            do {
                let status = try await api.fetch(watched.ticker)
                let (updated, alerts) = AlertRules.check(before: watched, now: status, checkedAt: Date())
                store.update(updated)
                for alert in alerts { await notifier.post(alert, siteURL: siteURL) }
            } catch StatusAPI.Failure.notFound {
                continue // unknown ticker: skip it, keep checking the others
            } catch {
                failed = true // network problem: the next check tries again (nothing is announced twice)
            }
        }
        await MainActor.run { NotificationCenter.default.post(name: .watchlistChanged, object: nil) }
        return !failed
    }
}

extension Notification.Name {
    /// Posted when a check finished or the watchlist changed, so screens can refresh.
    static let watchlistChanged = Notification.Name("watchlistChanged")
}
