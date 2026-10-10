@testable import StockValue
import XCTest

/// Same cases as the Android app's FileExportTest.
final class FileExportTests: XCTestCase {
    func testTheWebAppsFileNamesAreKept() {
        XCTAssertEqual(FileExport.safeName("my-portfolio.csv"), "my-portfolio.csv")
        XCTAssertEqual(FileExport.safeName("KO-10-year-figures.csv"), "KO-10-year-figures.csv")
        XCTAssertEqual(FileExport.safeName("BRK.B-10-year-figures.csv"), "BRK.B-10-year-figures.csv")
    }

    func testNamesCantLeaveTheExportFolderOrHideAsDotFiles() {
        XCTAssertEqual(FileExport.safeName("../../etc/passwd"), "passwd.csv")
        XCTAssertEqual(FileExport.safeName("..\\evil.csv"), "evil.csv")
        XCTAssertEqual(FileExport.safeName(".profile"), "profile.csv")
    }

    func testOddCharactersAreReplacedAndTheNameIsShortAndEndsInCsv() {
        XCTAssertEqual(FileExport.safeName("a b<c"), "a_b_c.csv")
        XCTAssertEqual(FileExport.safeName(""), "export.csv")
        XCTAssertEqual(FileExport.safeName("..."), "export.csv")
        XCTAssertEqual(FileExport.safeName(String(repeating: "x", count: 200)).count, 84)   // 80 characters plus ".csv"
    }
}
