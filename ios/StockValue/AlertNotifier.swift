import Foundation
import UserNotifications

/// Posts filing alerts as local notifications. Tapping one opens the company's analysis (the SEC history tab for
/// warnings); AppDelegate receives the tap.
///
/// TO CHANGE THE TEXT: the alert_* entries in en.lproj/Localizable.strings and es.lproj/Localizable.strings.
struct AlertNotifier {
    /// Asks for permission the first time a company is watched.
    static func requestPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
    }

    func post(_ alert: Alert, siteURL: String) async {
        let content = UNMutableNotificationContent()
        let tab: String?
        // Swift notes: `case let .newReport(ticker, name, report)` matches that kind of alert and names its values.
        switch alert {
        case let .newReport(ticker, name, report):
            content.title = String(format: String(localized: "alert_title"), name, ticker)
            content.body = String(format: String(localized: "alert_new_report"), report.form, report.date)
            tab = nil
        case let .warning(ticker, name, event):
            content.title = String(format: String(localized: "alert_title_warning"), name, ticker)
            content.body = Self.warningText(event)
            tab = "history"
        }
        content.sound = .default
        // The page to open when tapped (AppDelegate reads it). trigger: nil = show now.
        content.userInfo = ["url": SiteURLs.results(siteURL: siteURL, ticker: alert.ticker, tab: tab)]
        // Its own thread per alert: iOS would otherwise stack all of the app's alerts into one pile, hiding all but
        // the newest (Android does the same with one notification group per alert).
        content.threadIdentifier = Self.id(for: alert)
        let request = UNNotificationRequest(identifier: Self.id(for: alert), content: content, trigger: nil)
        try? await UNUserNotificationCenter.current().add(request)
    }

    static func warningText(_ e: FilingEvent) -> String {
        switch e.type {
        case "late_filing": return String(format: String(localized: "alert_late_filing"), e.form)
        case "non_reliance": return String(localized: "alert_non_reliance")
        case "auditor_change": return String(localized: "alert_auditor_change")
        case "amendment": return String(format: String(localized: "alert_amendment"), e.form)
        case "bankruptcy": return String(localized: "alert_bankruptcy")
        case "delisting_notice": return String(localized: "alert_delisting_notice")
        case "cyber_incident": return String(localized: "alert_cyber_incident")
        case "impairment": return String(localized: "alert_impairment")
        default: return e.form
        }
    }

    /// One id per filing, so the same alert replaces itself instead of appearing twice.
    static func id(for alert: Alert) -> String {
        switch alert {
        case let .newReport(ticker, _, report): return "\(ticker)|report|\(report.accession)"
        case let .warning(ticker, _, event): return "\(ticker)|\(event.key)"
        }
    }
}
