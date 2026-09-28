import Foundation

/// Reads a company's filing status from the web app's API: the same cached endpoint the web page uses, so the
/// app never talks to SEC directly. Only `latestReport` and `secHistory.events` are used.
struct StatusAPI {
    /// Must match API_VERSION in the web app (public/js/page.js). JSONTests pins it.
    static let apiVersion = 6

    enum Failure: Error, Equatable {
        case notFound
        case http(Int)
        case badResponse
    }

    let siteURL: String

    /// Asks the API about one company. Swift notes: `async` = waits for the network without blocking the app;
    /// `throws` = can fail with an error the caller handles (`try await api.fetch("KO")` in a `do/catch`).
    /// TO CHANGE THE TIMEOUT: `timeoutInterval` below (seconds).
    func fetch(_ ticker: String) async throws -> CompanyStatus {
        var base = siteURL
        while base.hasSuffix("/") { base.removeLast() }
        let q = ticker.addingPercentEncoding(withAllowedCharacters: .alphanumerics.union(CharacterSet(charactersIn: ".-"))) ?? ticker
        guard let url = URL(string: "\(base)/api/financials?ticker=\(q)&v=\(Self.apiVersion)") else { throw Failure.badResponse }
        var request = URLRequest(url: url, timeoutInterval: 30)
        request.setValue("\(AppInfo.userAgentTag)/\(AppInfo.version)", forHTTPHeaderField: "User-Agent")
        let (data, response) = try await URLSession.shared.data(for: request)
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        if code == 404 { throw Failure.notFound }
        guard code == 200 else { throw Failure.http(code) }
        return try Self.parse(data)
    }

    /// Reads the parts of the API's JSON that alerts need (missing or null parts are simply absent).
    static func parse(_ data: Data) throws -> CompanyStatus {
        // `as? [String: Any]` tries to read the JSON as a dictionary; it gives nil (not a crash) if the shape differs.
        guard let d = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let ticker = d["ticker"] as? String else { throw Failure.badResponse }
        var report: Report?
        if let r = d["latestReport"] as? [String: Any], let form = r["form"] as? String,
           let date = r["date"] as? String, let accession = r["accession"] as? String {
            report = Report(form: form, date: date, accession: accession, url: r["url"] as? String ?? "")
        }
        let rawEvents = (d["secHistory"] as? [String: Any])?["events"] as? [[String: Any]] ?? []
        // compactMap keeps only the events that could be read (ones missing a date or type are skipped).
        let events = rawEvents.compactMap { e -> FilingEvent? in
            guard let date = e["date"] as? String, let type = e["type"] as? String else { return nil }
            return FilingEvent(date: date, type: type, form: e["form"] as? String ?? "", url: e["url"] as? String ?? "")
        }
        return CompanyStatus(ticker: ticker, name: d["name"] as? String ?? ticker, report: report, events: events)
    }
}
