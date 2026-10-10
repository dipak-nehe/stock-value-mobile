import Foundation

/// Files the web app hands to the app to save or share (its "Download CSV" buttons), see WebController.saveFile.
/// Same rules as the Android app's FileExport.kt; unit-tested in FileExportTests.
enum FileExport {
    /// Largest file accepted from the page (the CSVs are a few kilobytes).
    static let maxChars = 2_000_000

    /// A safe name for the shared file: only letters, digits, dot, dash and underscore (no folders, so it can't
    /// escape the app's export folder), at most 80 characters, ending in ".csv".
    static func safeName(_ name: String) -> String {
        let last = name.split(whereSeparator: { $0 == "/" || $0 == "\\" }).last.map(String.init) ?? ""
        let allowed = Set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-")
        var base = String(last.map { allowed.contains($0) ? $0 : "_" })
        while base.hasPrefix(".") { base.removeFirst() }
        base = String(base.prefix(80))
        let n = base.trimmingCharacters(in: .whitespaces).isEmpty ? "export" : base
        return n.lowercased().hasSuffix(".csv") ? n : "\(n).csv"
    }
}
