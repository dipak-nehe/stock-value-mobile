@testable import StockValue
import XCTest

/// Same cases as the Android app's SitePolicyTest.
final class SitePolicyTests: XCTestCase {
    private let policy = SitePolicy(siteURL: "https://www.equitymoat.com/")

    private func assertTarget(_ expected: SitePolicy.Target, _ url: String, line: UInt = #line) {
        XCTAssertEqual(policy.target(for: url), expected, url, line: line)
    }

    func testPagesOfTheWebAppStayInTheApp() {
        assertTarget(.app, "https://www.equitymoat.com/")
        assertTarget(.app, "https://www.equitymoat.com/?t=KO&lang=es#flags")
        assertTarget(.app, "https://www.equitymoat.com/compare.html?a=KO&b=PEP&pa=68")
        assertTarget(.app, "https://WWW.EquityMoat.com/")      // host names ignore case
        assertTarget(.app, "https://www.equitymoat.com:443/")  // explicit default port
    }

    func testOtherSitesOpenInTheBrowser() {
        assertTarget(.browser, "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=21344")
        assertTarget(.browser, "https://www.google.com/finance/quote/KO:NYSE")
        assertTarget(.browser, "https://github.com/dipak-nehe/stock-trend-analyzer")
        assertTarget(.browser, "mailto:someone@example.com")
    }

    func testLookalikeAddressesAreNotTreatedAsTheApp() {
        assertTarget(.browser, "https://www.equitymoat.com.example.com/")
        assertTarget(.browser, "https://evil-www.equitymoat.com/")
        assertTarget(.browser, "https://other.vercel.app/?next=www.equitymoat.com")
        assertTarget(.browser, "http://www.equitymoat.com/")        // plain HTTP never loads in the app
        assertTarget(.browser, "https://www.equitymoat.com:8443/")  // different port
    }

    func testUnsafeOrUnknownSchemesAreBlocked() {
        assertTarget(.block, "javascript:alert(1)")
        assertTarget(.block, "file:///var/mobile/secret.txt")
        assertTarget(.block, "tel:5551234")
        assertTarget(.block, "not a url")
        assertTarget(.block, "/relative/path")
    }
}
