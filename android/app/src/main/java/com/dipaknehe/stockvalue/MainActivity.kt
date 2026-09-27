package com.dipaknehe.stockvalue

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Message
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.ProgressBar
import android.widget.Toast
import android.widget.Toolbar
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.net.toUri
import androidx.core.view.updatePadding
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

/** The web app in a WebView, with loading, offline and back handling, plus the Watch button for filing alerts. */
class MainActivity : ComponentActivity() {

    companion object {
        /** Debug builds only: load this address instead of the live site (used by the instrumented tests). */
        const val EXTRA_SITE_URL = "com.dipaknehe.stockvalue.SITE_URL"
        const val USER_AGENT_TAG = "StockValueAndroid"
        private const val TAG = "StockValue"

        /** A page of the web app to open, e.g. from a filing-alert notification or the Watchlist screen. */
        const val EXTRA_OPEN_URL = "com.dipaknehe.stockvalue.OPEN_URL"
    }

    private lateinit var siteUrl: String
    private lateinit var policy: SitePolicy
    private lateinit var webView: WebView
    private lateinit var refresh: SwipeRefreshLayout
    private lateinit var progress: ProgressBar
    private lateinit var errorPanel: View
    private lateinit var toolbar: Toolbar
    private lateinit var store: WatchStore
    private var mainFrameFailed = false
    private var rendererGone = false
    private var currentTicker: String? = null

    // Android 13+: alerts need the notification permission, asked for the first time a company is watched.
    private val askNotifications = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    // Enabled once there is (or is about to be) page history; disabled on a fully loaded first page, so the
    // system's predictive "back to home" animation works there. When pressed it checks the live history.
    private val back = object : OnBackPressedCallback(false) {
        override fun handleOnBackPressed() {
            if (webView.canGoBack()) {
                webView.goBack()
            } else {
                isEnabled = false
                onBackPressedDispatcher.onBackPressed()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        intent.getStringExtra(EXTRA_SITE_URL)?.let { Site.debugOverride = it }
        siteUrl = Site.url
        policy = SitePolicy(siteUrl)
        store = WatchStore(this)
        webView = findViewById(R.id.web)
        refresh = findViewById(R.id.refresh)
        progress = findViewById(R.id.progress)
        errorPanel = findViewById(R.id.error)
        toolbar = findViewById(R.id.toolbar)
        toolbar.inflateMenu(R.menu.main)
        toolbar.setOnMenuItemClickListener { item ->
            when (item.itemId) {
                R.id.action_watch -> { toggleWatch(); true }
                R.id.action_watchlist -> { startActivity(Intent(this, WatchlistActivity::class.java)); true }
                else -> false
            }
        }

        applyInsets()
        configureWebView()
        onBackPressedDispatcher.addCallback(this, back)
        refresh.setOnRefreshListener { reload() }
        // Only pull-to-refresh when the page itself is scrolled to the top.
        refresh.setOnChildScrollUpCallback { _, _ -> webView.scrollY > 0 }
        findViewById<Button>(R.id.retry).setOnClickListener { reload() }

        // A requested page (notification, Watchlist) wins over the page restored from before.
        val requested = pageFrom(intent)
        if (requested != null) {
            load(requested, "requested at start")
        } else if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            load(siteUrl, "start page")
        } else {
            debug("restored ${webView.url}")
        }
    }

    // A notification or the Watchlist screen asked for a page while the app was already open.
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        pageFrom(intent)?.let {
            mainFrameFailed = false
            back.isEnabled = true
            load(it, "requested while open")
        }
    }

    override fun onResume() {
        super.onResume()
        updateWatchAction()  // the company may have been removed on the Watchlist screen
    }

    /** Only pages of the web app itself are opened this way. */
    private fun pageFrom(intent: Intent?): String? =
        intent?.getStringExtra(EXTRA_OPEN_URL)?.takeIf { policy.targetFor(it) == SitePolicy.Target.APP }

    /** Show the Watch button on a company's results page, reflecting whether it's watched. */
    private fun updateWatchAction(url: String? = webView.url) {
        currentTicker = SiteUrls.tickerOf(url, siteUrl)
        val item = toolbar.menu.findItem(R.id.action_watch) ?: return
        val ticker = currentTicker
        item.isVisible = ticker != null
        if (ticker == null) return
        val watching = store.contains(ticker)
        item.setIcon(if (watching) R.drawable.ic_star else R.drawable.ic_star_border)
        item.title = getString(if (watching) R.string.action_watching else R.string.action_watch, ticker)
    }

    private fun toggleWatch() {
        val ticker = currentTicker ?: return
        if (store.contains(ticker)) {
            store.remove(ticker)
            Toast.makeText(this, getString(R.string.unwatched, ticker), Toast.LENGTH_SHORT).show()
        } else if (!store.add(ticker)) {
            Toast.makeText(this, getString(R.string.watchlist_full, WatchStore.MAX), Toast.LENGTH_LONG).show()
            return
        } else {
            Toast.makeText(this, getString(R.string.watched, ticker), Toast.LENGTH_LONG).show()
            if (Build.VERSION.SDK_INT >= 33 &&
                ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
            ) {
                askNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
            FilingChecks.checkNow(this)  // records today's filings as the starting point
        }
        FilingChecks.sync(this)
        updateWatchAction()
    }

    // The app draws edge to edge; pad the content so it sits between the status bar, navigation bar and keyboard.
    private fun applyInsets() {
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.root)) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            view.updatePadding(left = bars.left, top = bars.top, right = bars.right, bottom = maxOf(bars.bottom, ime.bottom))
            WindowInsetsCompat.CONSUMED
        }
    }

    // JavaScript is required: the web app is a JavaScript page. No JavaScript bridge is exposed to it.
    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        // Debug builds only: lets Appium (e2e/) and Chrome DevTools inspect the page. Release builds stay closed.
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true)
        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true          // the web app remembers the chosen language
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportMultipleWindows(true)   // target=_blank links arrive in onCreateWindow (see below)
            userAgentString = "$userAgentString $USER_AGENT_TAG/${BuildConfig.VERSION_NAME}"
        }
        webView.webViewClient = PageClient()
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                progress.progress = newProgress
            }

            // A new-tab link (target=_blank). Hand the page a throwaway WebView, read the address it tries to load,
            // and route that address like any other link. The throwaway WebView's client handles onRenderProcessGone;
            // the androidx.webkit lint check doesn't detect Kotlin overrides (false positive).
            @SuppressLint("MissingOnRenderProcessGone")
            override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message): Boolean {
                val popup = WebView(view.context)
                popup.webViewClient = object : WebViewClient() {
                    private var handled = false

                    private fun take(uri: Uri) {
                        if (handled) return
                        handled = true
                        route(uri)
                        popup.post { popup.destroy() }
                    }

                    override fun shouldOverrideUrlLoading(v: WebView, request: WebResourceRequest): Boolean {
                        take(request.url)
                        return true
                    }

                    override fun onPageStarted(v: WebView, url: String?, favicon: Bitmap?) {
                        if (!url.isNullOrEmpty() && url != "about:blank") take(url.toUri())
                    }

                    override fun onRenderProcessGone(v: WebView, detail: RenderProcessGoneDetail): Boolean {
                        v.destroy()
                        return true
                    }
                }
                (resultMsg.obj as WebView.WebViewTransport).webView = popup
                resultMsg.sendToTarget()
                return true
            }
        }
    }

    /** Keeps the web app's pages in the WebView and handles loading, errors and renderer crashes. */
    // onRenderProcessGone is implemented below; the androidx.webkit lint check doesn't detect it (false positive).
    @SuppressLint("MissingOnRenderProcessGone")
    private inner class PageClient : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            if (policy.targetFor(request.url.toString()) == SitePolicy.Target.APP) {
                back.isEnabled = true  // this navigation adds history; Back may be pressed before it finishes loading
                return false
            }
            route(request.url)
            return true
        }

        override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
            progress.visibility = View.VISIBLE
        }

        override fun onPageFinished(view: WebView, url: String?) {
            progress.visibility = View.GONE
            refresh.isRefreshing = false
            back.isEnabled = view.canGoBack()  // history is settled once the page has loaded
            updateWatchAction(url)
            if (!mainFrameFailed) showPage()
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (request.isForMainFrame) showError()
        }

        // The page's renderer crashed or was killed to free memory. Without this the whole app would crash;
        // instead drop the dead WebView and start the screen again.
        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            rendererGone = true
            (view.parent as? ViewGroup)?.removeView(view)
            view.destroy()
            recreate()
            return true
        }

        override fun doUpdateVisitedHistory(view: WebView, url: String?, isReload: Boolean) {
            if (view.canGoBack()) back.isEnabled = true  // only ever enable here: this can run before history updates
            updateWatchAction(url)  // the web app changes the address (e.g. ?t=KO) without a page load
        }
    }

    /** Open a link according to [SitePolicy]: in this WebView, in another app, or not at all. */
    private fun route(uri: Uri) {
        when (policy.targetFor(uri.toString())) {
            SitePolicy.Target.APP -> {
                back.isEnabled = true
                load(uri.toString(), "new-tab link")
            }
            SitePolicy.Target.BROWSER -> openElsewhere(uri)
            SitePolicy.Target.BLOCK -> Unit
        }
    }

    private fun reload() {
        mainFrameFailed = false
        val current = webView.url
        if (current.isNullOrEmpty() || current == "about:blank") load(siteUrl, "retry with no page") else webView.reload()
    }

    private fun load(url: String, why: String) {
        debug("load $url ($why)")
        webView.loadUrl(url)
    }

    /** Debug builds only: a trace of page loads, used when diagnosing the end-to-end tests. */
    private fun debug(message: String) {
        if (BuildConfig.DEBUG) Log.d(TAG, message)
    }

    private fun showPage() {
        errorPanel.visibility = View.GONE
        webView.visibility = View.VISIBLE
    }

    private fun showError() {
        mainFrameFailed = true
        webView.visibility = View.INVISIBLE
        errorPanel.visibility = View.VISIBLE
        refresh.isRefreshing = false
    }

    private fun openElsewhere(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE))
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(this, R.string.no_app_for_link, Toast.LENGTH_SHORT).show()
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        if (!rendererGone) webView.saveState(outState)
    }

    override fun onDestroy() {
        if (!rendererGone) webView.destroy()
        super.onDestroy()
    }
}
