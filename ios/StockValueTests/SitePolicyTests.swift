@testable import StockValue
import XCTest

/// Same cases as the Android app's SitePolicyTest.
final class SitePolicyTests: XCTestCase {
    private let policy = SitePolicy(siteURL: "https://stock-value-analysis.vercel.app/")

    private func assertTarget(_ expected: SitePolicy.Target, _ url: String, line: UInt = #line) {
        XCTAssertEqual(policy.target(for: url), expected, url, line: line)
    }

    func testPagesOfTheWebAppStayInTheApp() {
        assertTarget(.app, "https://stock-value-analysis.vercel.app/")
        assertTarget(.app, "https://stock-value-analysis.vercel.app/?t=KO&lang=es#flags")
        assertTarget(.app, "https://stock-value-analysis.vercel.app/compare.html?a=KO&b=PEP&pa=68")
        assertTarget(.app, "https://Stock-Value-Analysis.Vercel.app/")      // host names ignore case
        assertTarget(.app, "https://stock-value-analysis.vercel.app:443/")  // explicit default port
    }

    func testOtherSitesOpenInTheBrowser() {
        assertTarget(.browser, "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=21344")
        assertTarget(.browser, "https://www.google.com/finance/quote/KO:NYSE")
        assertTarget(.browser, "https://github.com/dipak-nehe/stock-trend-analyzer")
        assertTarget(.browser, "mailto:someone@example.com")
    }

    func testLookalikeAddressesAreNotTreatedAsTheApp() {
        assertTarget(.browser, "https://stock-value-analysis.vercel.app.example.com/")
        assertTarget(.browser, "https://evil-stock-value-analysis.vercel.app/")
        assertTarget(.browser, "https://other.vercel.app/?next=stock-value-analysis.vercel.app")
        assertTarget(.browser, "http://stock-value-analysis.vercel.app/")        // plain HTTP never loads in the app
        assertTarget(.browser, "https://stock-value-analysis.vercel.app:8443/")  // different port
    }

    func testUnsafeOrUnknownSchemesAreBlocked() {
        assertTarget(.block, "javascript:alert(1)")
        assertTarget(.block, "file:///var/mobile/secret.txt")
        assertTarget(.block, "tel:5551234")
        assertTarget(.block, "not a url")
        assertTarget(.block, "/relative/path")
    }
}
