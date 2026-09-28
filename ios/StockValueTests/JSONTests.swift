@testable import StockValue
import XCTest

/// Same cases as the Android app's JsonTest.
final class JSONTests: XCTestCase {
    // Trimmed from a real /api/financials?ticker=KO&v=5 response.
    private let api = """
    {"ticker": "KO", "name": "COCA COLA CO", "cik": 21344, "years": [2024, 2025],
     "series": {"revenue": [1, 2]},
     "secHistory": {"since": "2016-01-01", "events": [
        {"date": "2022-10-17", "type": "sec_letter", "form": "UPLOAD", "description": "SEC staff letter", "url": "https://www.sec.gov/a.pdf"},
        {"date": "2019-03-01", "type": "late_filing", "form": "NT 10-K", "description": "Notice of late filing", "url": "https://www.sec.gov/b.htm"}
     ], "counts": {}},
     "latestReport": {"form": "10-Q", "date": "2026-07-29", "accession": "0001628280-26-050503",
                      "url": "https://www.sec.gov/Archives/edgar/data/21344/000162828026050503/ko-20260703.htm"}}
    """

    func testAPIResponsesAreRead() throws {
        let s = try StatusAPI.parse(Data(api.utf8))
        XCTAssertEqual(s.ticker, "KO")
        XCTAssertEqual(s.name, "COCA COLA CO")
        XCTAssertEqual(s.report, Report(form: "10-Q", date: "2026-07-29", accession: "0001628280-26-050503",
                                        url: "https://www.sec.gov/Archives/edgar/data/21344/000162828026050503/ko-20260703.htm"))
        XCTAssertEqual(s.events.map(\.type), ["sec_letter", "late_filing"])
        XCTAssertEqual(s.events[1].key, "2019-03-01|late_filing|NT 10-K|https://www.sec.gov/b.htm")
    }

    func testResponsesWithoutHistoryOrReportAreRead() throws {
        let s = try StatusAPI.parse(Data(#"{"ticker": "NEWCO", "name": "New Co", "secHistory": null, "latestReport": null}"#.utf8))
        XCTAssertNil(s.report)
        XCTAssertEqual(s.events, [])
    }

    func testTheWatchlistSurvivesSavingAndLoading() {
        let defaults = UserDefaults(suiteName: "JSONTests")!
        defaults.removePersistentDomain(forName: "JSONTests")
        let store = WatchStore(defaults: defaults)
        XCTAssertTrue(store.add("KO"))
        XCTAssertTrue(store.add("PEP"))
        XCTAssertFalse(store.add("KO")) // already watched
        let checked = Watched(ticker: "KO", name: "COCA COLA CO", report: Report(form: "10-Q", date: "2026-07-29", accession: "0001-26-1", url: "https://sec/q"),
                              seenEvents: ["a|late_filing|NT 10-K|u"], baselined: true, lastChecked: Date(timeIntervalSince1970: 1_760_000_000))
        store.update(checked)
        XCTAssertEqual(WatchStore(defaults: defaults).all(), [checked, Watched(ticker: "PEP")]) // a fresh store reads it back
        store.remove("KO")
        XCTAssertEqual(store.all().map(\.ticker), ["PEP"])
    }

    func testTheWatchlistIsCapped() {
        let defaults = UserDefaults(suiteName: "JSONTestsCap")!
        defaults.removePersistentDomain(forName: "JSONTestsCap")
        let store = WatchStore(defaults: defaults)
        for i in 0..<WatchStore.max { XCTAssertTrue(store.add("T\(i)")) }
        XCTAssertFalse(store.add("ONEMORE"))
    }

    func testTheAPIVersionMatchesTheWebApp() {
        // public/js/page.js API_VERSION; a mismatch would split the CDN cache and could miss new fields
        XCTAssertEqual(StatusAPI.apiVersion, 6)
    }
}
