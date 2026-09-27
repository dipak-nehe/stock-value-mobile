import Foundation

/// Decides where a link opens: pages of the web app stay in the app, other web and mail links open in the
/// phone's browser or mail app, and anything else (javascript:, file:, tel:, …) is blocked.
/// Pure Swift with no UIKit, so it's unit-tested (SitePolicyTests). Same rules as the Android app's SitePolicy.kt.
///
/// TO LET ANOTHER KIND OF LINK OPEN ELSEWHERE: add its scheme to `outsideSchemes`, and a case to SitePolicyTests.
struct SitePolicy {
    enum Target { case app, browser, block }

    private let site: URLComponents?
    private let outsideSchemes: Set<String> = ["https", "http", "mailto"]

    init(siteURL: String) {
        site = URLComponents(string: siteURL)
    }

    func target(for url: String) -> Target {
        // `guard let … else { return .block }`: if the address can't be read or has no scheme, block it.
        guard let link = URLComponents(string: url), let scheme = link.scheme?.lowercased() else { return .block }
        if isSameSite(link, scheme: scheme) { return .app }
        return outsideSchemes.contains(scheme) ? .browser : .block
    }

    // Same scheme, host (any letter case) and port as the web app; lookalike hosts and plain http don't match.
    private func isSameSite(_ link: URLComponents, scheme: String) -> Bool {
        guard let site, let siteScheme = site.scheme?.lowercased(), let host = link.host, let siteHost = site.host else {
            return false
        }
        return scheme == siteScheme && host.lowercased() == siteHost.lowercased() && port(link) == port(site)
    }

    // An address without a port uses the default: 443 for https, 80 for http.
    private func port(_ c: URLComponents) -> Int {
        c.port ?? (c.scheme?.lowercased() == "https" ? 443 : 80)
    }
}
