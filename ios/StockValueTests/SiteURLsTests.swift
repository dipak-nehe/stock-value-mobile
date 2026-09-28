@testable import StockValue
import XCTest

/// Same cases as the Android app's SiteUrlsTest.
final class SiteURLsTests: XCTestCase {
    private let site = "https://stock-value-analysis.vercel.app/"

    func testResultsPagesGiveTheirTicker() {
        XCTAssertEqual(SiteURLs.ticker(of: "https://stock-value-analysis.vercel.app/?t=KO", siteURL: site), "KO")
        XCTAssertEqual(SiteURLs.ticker(of: "https://stock-value-analysis.vercel.app/?t=ko&lang=es#flags", siteURL: site), "KO")
        XCTAssertEqual(SiteURLs.ticker(of: "https://stock-value-analysis.vercel.app/?lang=es&t=SMCI&p=30", siteURL: site), "SMCI")
        XCTAssertEqual(SiteURLs.ticker(of: "https://stock-value-analysis.vercel.app/index.html?t=BRK.B", siteURL: site), "BRK.B")
    }

    func testOtherPagesHaveNoTicker() {
        XCTAssertNil(SiteURLs.ticker(of: "https://stock-value-analysis.vercel.app/", siteURL: site))
        XCTAssertNil(SiteURLs.ticker(of: "https://stock-value-analysis.vercel.app/?lang=es", siteURL: site))
        XCTAssertNil(SiteURLs.ticker(of: "https://stock-value-analysis.vercel.app/compare.html?a=KO&b=PEP", siteURL: site))
        XCTAssertNil(SiteURLs.ticker(of: "https://www.sec.gov/?t=KO", siteURL: site))
        XCTAssertNil(SiteURLs.ticker(of: "https://stock-value-analysis.vercel.app/?t=", siteURL: site))
        XCTAssertNil(SiteURLs.ticker(of: "https://stock-value-analysis.vercel.app/?t=%3Cscript%3E", siteURL: site))
        XCTAssertNil(SiteURLs.ticker(of: nil, siteURL: site))
    }

    func testResultsAddressesAreBuiltForATickerAndTab() {
        XCTAssertEqual(SiteURLs.results(siteURL: site, ticker: "KO"), "https://stock-value-analysis.vercel.app/?t=KO")
        XCTAssertEqual(SiteURLs.results(siteURL: site, ticker: "SMCI", tab: "history"), "https://stock-value-analysis.vercel.app/?t=SMCI#history")
        XCTAssertEqual(SiteURLs.results(siteURL: "http://localhost:8080", ticker: "BRK.B"), "http://localhost:8080/?t=BRK.B")
    }
}
