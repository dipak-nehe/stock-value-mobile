import Foundation

// The data the filing alerts work with, and the rules that decide what's new. Same rules as the Android app's
// Filings.kt, and unit-tested the same way (AlertRulesTests).

/// The newest annual or quarterly report (10-K, 10-Q, 20-F, 40-F or an amendment), from the API's `latestReport`.
struct Report: Codable, Equatable {
    let form: String
    let date: String
    let accession: String
    let url: String
}

/// One notable filing from the API's `secHistory.events` (e.g. type "late_filing", form "NT 10-K").
struct FilingEvent: Codable, Equatable {
    let date: String
    let type: String
    let form: String
    let url: String

    /// Identifies the filing, so the same one is never announced twice.
    var key: String { "\(date)|\(type)|\(form)|\(url)" }
}

/// What the API currently says about a company, as far as alerts are concerned.
struct CompanyStatus: Equatable {
    let ticker: String
    let name: String
    let report: Report?
    let events: [FilingEvent]
}

/// A watched company and what was already seen at the last check. `baselined` is false until the first successful
/// check: that check only records the current state, so watching a company never alerts about old filings.
struct Watched: Codable, Equatable {
    var ticker: String
    var name: String? = nil
    var report: Report? = nil
    var seenEvents: Set<String> = []
    var baselined = false
    var lastChecked: Date? = nil
}

/// A notification to post.
enum Alert: Equatable {
    case newReport(ticker: String, name: String, report: Report)
    case warning(ticker: String, name: String, event: FilingEvent)

    var ticker: String {
        switch self {
        case let .newReport(ticker, _, _), let .warning(ticker, _, _): return ticker
        }
    }

    var name: String {
        switch self {
        case let .newReport(_, name, _), let .warning(_, name, _): return name
        }
    }
}

/// Decides which notifications a check produces.
enum AlertRules {
    /// Warnings worth a notification: restatement warnings, auditor changes, late-filing notices, amended annual reports.
    /// TO ALERT ON MORE KINDS: add the type here, its text in AlertNotifier.warningText and Localizable.strings.
    static let serious: Set<String> = ["non_reliance", "auditor_change", "late_filing", "amendment"]

    /// The updated watch state and the alerts to post.
    static func check(before: Watched, now: CompanyStatus, checkedAt: Date) -> (Watched, [Alert]) {
        var updated = before
        updated.name = now.name
        updated.report = now.report ?? before.report
        updated.seenEvents = before.seenEvents.union(now.events.map(\.key))
        updated.baselined = true
        updated.lastChecked = checkedAt
        // First check after watching: just remember what exists today.
        guard before.baselined else { return (updated, []) }

        var alerts: [Alert] = []
        if let report = now.report, report.accession != before.report?.accession,
           before.report == nil || report.date >= before.report!.date {
            alerts.append(.newReport(ticker: now.ticker, name: now.name, report: report))
        }
        let fresh = now.events
            .filter { serious.contains($0.type) && !before.seenEvents.contains($0.key) }
            .sorted { $0.date < $1.date }
        alerts += fresh.map { .warning(ticker: now.ticker, name: now.name, event: $0) }
        return (updated, alerts)
    }
}
