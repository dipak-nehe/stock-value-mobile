import SwiftUI
import UIKit
import UserNotifications

/// The app's entry point (`@main`): iOS starts here and shows RootView in a window.
@main
struct StockValueApp: App {
    // Connects the classic AppDelegate (below) for the parts SwiftUI doesn't cover: background tasks, notification taps.
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var delegate

    var body: some Scene {
        WindowGroup {
            RootView().environmentObject(AppModel.shared)
        }
    }
}

/// Registers the background check and handles notification taps.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        FilingChecks.register()
        FilingChecks.schedule()
        return true
    }

    // Show alerts even while the app is open (otherwise iOS only shows them when the app is in the background).
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async
        -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }

    // A tap on an alert: open the company's page.
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        guard let url = response.notification.request.content.userInfo["url"] as? String else { return }
        await MainActor.run { AppModel.shared.open(url) }
    }
}
