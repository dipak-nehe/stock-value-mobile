import Foundation

/// Addresses of pages in the web app: "which company is this page showing?" and "build the page for company X".
/// Pure Swift, unit-tested (SiteURLsTests). Same rules as the Android app's SiteUrls.kt.
enum SiteURLs {
    /// The ticker shown by a results page (`/?t=KO` → "KO"), or nil for the start page, the compare page,
    /// another website, or anything that doesn't look like a ticker.
    static func ticker(of url: String?, siteURL: String) -> String? {
        guard let url, SitePolicy(siteURL: siteURL).target(for: url) == .app, let c = URLComponents(string: url) else {
            return nil
        }
        guard c.path == "" || c.path == "/" || c.path == "/index.html" else { return nil }
        guard let t = c.queryItems?.first(where: { $0.name == "t" })?.value?
            .trimmingCharacters(in: .whitespaces).uppercased(), !t.isEmpty else { return nil }
        // 1–10 capital letters, digits, dots or dashes (e.g. KO, BRK.B, BF-B).
        return t.range(of: "^[A-Z0-9.\\-]{1,10}$", options: .regularExpression) != nil ? t : nil
    }

    /// The results page for a ticker, optionally opened on a tab: results(site, "SMCI", "history") → "…/?t=SMCI#history".
    static func results(siteURL: String, ticker: String, tab: String? = nil) -> String {
        var base = siteURL
        while base.hasSuffix("/") { base.removeLast() }
        let encoded = ticker.addingPercentEncoding(withAllowedCharacters: .alphanumerics.union(CharacterSet(charactersIn: ".-"))) ?? ticker
        return base + "/?t=" + encoded + (tab.map { "#\($0)" } ?? "")
    }
}
