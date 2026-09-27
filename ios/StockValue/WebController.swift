import SwiftUI
import UIKit
import WebKit

/// Owns the WKWebView: loading, link routing (SitePolicy), new-tab links, pull to refresh, the offline state,
/// renderer crashes and Back. Same behaviour as the Android app's MainActivity.
@MainActor
final class WebController: NSObject, ObservableObject {
    let webView: WKWebView
    @Published var progress: Double = 0
    @Published var isLoading = false
    @Published var failed = false
    @Published var canGoBack = false

    private let model: AppModel
    private let policy: SitePolicy
    private var observations: [NSKeyValueObservation] = []

    init(model: AppModel) {
        self.model = model
        self.policy = SitePolicy(siteURL: model.siteURL)
        let config = WKWebViewConfiguration()
        // Adds "StockValueiOS/1.0" to the browser's user agent so the site can tell app visits apart.
        config.applicationNameForUserAgent = "\(AppInfo.userAgentTag)/\(AppInfo.version)"
        config.websiteDataStore = .default() // the web app remembers the chosen language
        webView = WKWebView(frame: .zero, configuration: config)
        super.init()
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true // swipe from the edge to go back
        webView.accessibilityIdentifier = "web-view"
        #if DEBUG
        if #available(iOS 16.4, *) { webView.isInspectable = true } // lets Appium and Safari's inspector reach the page
        #endif
        let refresh = UIRefreshControl()
        refresh.addTarget(self, action: #selector(pulledToRefresh(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refresh

        observations = [
            webView.observe(\.estimatedProgress, options: .new) { [weak self] view, _ in
                Task { @MainActor in self?.progress = view.estimatedProgress }
            },
            webView.observe(\.isLoading, options: .new) { [weak self] view, _ in
                Task { @MainActor in self?.isLoading = view.isLoading }
            },
            // The web app changes the address without a page load (e.g. to ?t=KO): keep the Watch star in step.
            webView.observe(\.url, options: .new) { [weak self] view, _ in
                Task { @MainActor in
                    self?.model.currentURL = view.url?.absoluteString
                    self?.canGoBack = view.canGoBack
                }
            },
        ]
    }

    func load(_ url: String) {
        guard let u = URL(string: url) else { return }
        failed = false
        webView.load(URLRequest(url: u))
    }

    /// Pull to refresh and "Try again": reload the page, or the start page if nothing loaded yet.
    func reload() {
        failed = false
        if webView.url == nil { load(model.siteURL) } else { webView.reload() }
    }

    func goBack() {
        if webView.canGoBack { webView.goBack() }
    }

    @objc private func pulledToRefresh(_ sender: UIRefreshControl) {
        reload()
        sender.endRefreshing()
    }

    /// Open a link according to SitePolicy: in this web view, in another app, or not at all.
    func route(_ url: URL) {
        switch policy.target(for: url.absoluteString) {
        case .app: webView.load(URLRequest(url: url))
        case .browser: UIApplication.shared.open(url)
        case .block: break
        }
    }
}

extension WebController: WKNavigationDelegate, WKUIDelegate {
    // Every navigation: pages of the web app load here; other links go to another app or are blocked.
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard let url = action.request.url else { return .allow }
        // Subframes, and new-tab requests (no target frame; routed in createWebViewWith), load as usual.
        guard let frame = action.targetFrame, frame.isMainFrame else { return .allow }
        if url.absoluteString == "about:blank" || policy.target(for: url.absoluteString) == .app { return .allow }
        route(url)
        return .cancel
    }

    // A new-tab link (target=_blank): route it like any other link instead of opening a window.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url { route(url) }
        return nil
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        failed = false
        canGoBack = webView.canGoBack
        model.currentURL = webView.url?.absoluteString
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        showErrorUnlessCancelled(error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        showErrorUnlessCancelled(error)
    }

    // The page's renderer was killed (e.g. to free memory): reload instead of showing a blank page.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        reload()
    }

    private func showErrorUnlessCancelled(_ error: Error) {
        let e = error as NSError
        if e.domain == NSURLErrorDomain && e.code == NSURLErrorCancelled { return } // a newer load replaced it
        if e.domain == "WebKitErrorDomain" && e.code == 102 { return } // "frame load interrupted" (handed to another app)
        failed = true
    }
}

/// Puts the controller's WKWebView into SwiftUI.
struct WebView: UIViewRepresentable {
    let controller: WebController

    func makeUIView(context: Context) -> WKWebView { controller.webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
