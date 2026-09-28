import Foundation

/// App-wide settings.
///
/// TO CHANGE THE SITE: edit `SiteURL` in project.yml (Info.plist). Debug builds can be pointed at another server with
/// the launch argument `-SiteURL http://localhost:8765/` (the end-to-end tests do), which iOS exposes through UserDefaults.
enum AppInfo {
    static let userAgentTag = "StockValueiOS"

    static var version: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
    }

    static var siteURL: String {
        #if DEBUG
        if let override = UserDefaults.standard.string(forKey: "SiteURL"), !override.isEmpty { return override }
        #endif
        return Bundle.main.object(forInfoDictionaryKey: "SiteURL") as? String ?? "https://stock-value-analysis.vercel.app/"
    }

    /// Debug builds only: a page to open at launch (`-OpenURL …`), like tapping a notification.
    static var launchPage: String? {
        #if DEBUG
        return UserDefaults.standard.string(forKey: "OpenURL")
        #else
        return nil
        #endif
    }
}
