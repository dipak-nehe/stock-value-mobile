import Foundation

/// The watchlist, kept on the phone only (UserDefaults, as JSON). It never leaves the device.
///
/// TO CHANGE HOW MANY COMPANIES CAN BE WATCHED: edit `max`.
final class WatchStore {
    static let max = 25
    private let defaults: UserDefaults
    private let key = "watched"
    private let lock = NSLock()

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func all() -> [Watched] {
        guard let data = defaults.data(forKey: key) else { return [] }
        return (try? JSONDecoder().decode([Watched].self, from: data)) ?? []
    }

    func contains(_ ticker: String) -> Bool {
        all().contains { $0.ticker == ticker }
    }

    /// Adds a company; false if it's already watched or the list is full.
    @discardableResult
    func add(_ ticker: String) -> Bool {
        lock.lock(); defer { lock.unlock() }
        var list = all()
        guard list.count < Self.max, !list.contains(where: { $0.ticker == ticker }) else { return false }
        list.append(Watched(ticker: ticker))
        save(list)
        return true
    }

    func remove(_ ticker: String) {
        lock.lock(); defer { lock.unlock() }
        save(all().filter { $0.ticker != ticker })
    }

    /// Saves a check result, unless the company was removed while the check ran.
    func update(_ watched: Watched) {
        lock.lock(); defer { lock.unlock() }
        var list = all()
        guard let i = list.firstIndex(where: { $0.ticker == watched.ticker }) else { return }
        list[i] = watched
        save(list)
    }

    func clear() {
        lock.lock(); defer { lock.unlock() }
        defaults.removeObject(forKey: key)
    }

    private func save(_ list: [Watched]) {
        if let data = try? JSONEncoder().encode(list) { defaults.set(data, forKey: key) }
    }
}
