@testable import StockValue
import XCTest

/// Same cases as the Android app's AlertRulesTest.
final class AlertRulesTests: XCTestCase {
    private let q2 = Report(form: "10-Q", date: "2026-04-28", accession: "0001-26-000010", url: "https://sec/q2")
    private let q3 = Report(form: "10-Q", date: "2026-07-29", accession: "0001-26-000020", url: "https://sec/q3")
    private let letter = FilingEvent(date: "2026-05-01", type: "sec_letter", form: "UPLOAD", url: "https://sec/letter")
    private let late = FilingEvent(date: "2026-08-15", type: "late_filing", form: "NT 10-K", url: "https://sec/nt")
    private let auditor = FilingEvent(date: "2026-08-20", type: "auditor_change", form: "8-K", url: "https://sec/8k")
    private let t1 = Date(timeIntervalSince1970: 100), t2 = Date(timeIntervalSince1970: 200), t3 = Date(timeIntervalSince1970: 300)

    private func status(_ report: Report?, _ events: FilingEvent...) -> CompanyStatus {
        CompanyStatus(ticker: "KO", name: "COCA COLA CO", report: report, events: events)
    }

    private func baselined(_ report: Report?, _ seen: FilingEvent...) -> Watched {
        Watched(ticker: "KO", name: "COCA COLA CO", report: report, seenEvents: Set(seen.map(\.key)), baselined: true, lastChecked: t1)
    }

    func testTheFirstCheckOnlyRecordsTheStartingPoint() {
        let (updated, alerts) = AlertRules.check(before: Watched(ticker: "KO"), now: status(q3, late, letter), checkedAt: t1)
        XCTAssertEqual(alerts, []) // no alerts about filings from before watching
        XCTAssertTrue(updated.baselined)
        XCTAssertEqual(updated.report, q3)
        XCTAssertEqual(updated.seenEvents, [late.key, letter.key])
        XCTAssertEqual(updated.name, "COCA COLA CO")
        XCTAssertEqual(updated.lastChecked, t1)
    }

    func testNothingNewMeansNoAlerts() {
        let (updated, alerts) = AlertRules.check(before: baselined(q3, late), now: status(q3, late), checkedAt: t2)
        XCTAssertEqual(alerts, [])
        XCTAssertEqual(updated.lastChecked, t2)
    }

    func testANewReportIsAnnounced() {
        let (updated, alerts) = AlertRules.check(before: baselined(q2), now: status(q3), checkedAt: t2)
        XCTAssertEqual(alerts, [.newReport(ticker: "KO", name: "COCA COLA CO", report: q3)])
        XCTAssertEqual(updated.report, q3)
    }

    func testAFirstEverReportIsAnnounced() {
        let (_, alerts) = AlertRules.check(before: baselined(nil), now: status(q3), checkedAt: t2)
        XCTAssertEqual(alerts, [.newReport(ticker: "KO", name: "COCA COLA CO", report: q3)])
    }

    func testAnOlderReportShowingUpLateIsNotAnnounced() {
        let (_, alerts) = AlertRules.check(before: baselined(q3), now: status(q2), checkedAt: t2)
        XCTAssertEqual(alerts, [])
    }

    func testNewSeriousWarningsAreAnnouncedOldestFirstOtherEventsAreNot() {
        let (updated, alerts) = AlertRules.check(before: baselined(q3), now: status(q3, auditor, late, letter), checkedAt: t2)
        XCTAssertEqual(alerts, [
            .warning(ticker: "KO", name: "COCA COLA CO", event: late),
            .warning(ticker: "KO", name: "COCA COLA CO", event: auditor),
        ])
        XCTAssertTrue(updated.seenEvents.contains(letter.key)) // SEC letters are recorded but not announced
    }

    func testAWarningIsAnnouncedOnlyOnce() {
        let (afterFirst, first) = AlertRules.check(before: baselined(q3), now: status(q3, late), checkedAt: t2)
        let (_, second) = AlertRules.check(before: afterFirst, now: status(q3, late), checkedAt: t3)
        XCTAssertEqual(first.count, 1)
        XCTAssertEqual(second, [])
    }

    func testAMissingReportInTheResponseKeepsTheKnownOne() {
        let (updated, alerts) = AlertRules.check(before: baselined(q3), now: status(nil), checkedAt: t2)
        XCTAssertEqual(updated.report, q3)
        XCTAssertEqual(alerts, [])
    }

    func testOnlyTheAgreedTypesCountAsSerious() {
        XCTAssertEqual(AlertRules.serious, ["non_reliance", "auditor_change", "late_filing", "amendment"])
    }
}
