package com.dipaknehe.stockvalue

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.os.Message
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
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

/** A full-screen WebView showing the web app, with loading, offline and back-navigation handling. */
class MainActivity : ComponentActivity() {

    companion object {
        /** Debug builds only: load this address instead of the live site (used by the instrumented tests). */
        const val EXTRA_SITE_URL = "com.dipaknehe.stockvalue.SITE_URL"
        const val USER_AGENT_TAG = "StockValueAndroid"
    }

    private lateinit var siteUrl: String
    private lateinit var policy: SitePolicy
    private lateinit var webView: WebView
    private lateinit var refresh: SwipeRefreshLayout
    private lateinit var progress: ProgressBar
    private lateinit var errorPanel: View
    private var mainFrameFailed = false
    private var rendererGone = false

    // Enabled only while the page has history, so at the first page the system's predictive "back to home" works.
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

        siteUrl = intent.getStringExtra(EXTRA_SITE_URL)?.takeIf { BuildConfig.DEBUG } ?: BuildConfig.SITE_URL
        policy = SitePolicy(siteUrl)
        webView = findViewById(R.id.web)
        refresh = findViewById(R.id.refresh)
        progress = findViewById(R.id.progress)
        errorPanel = findViewById(R.id.error)

        applyInsets()
        configureWebView()
        onBackPressedDispatcher.addCallback(this, back)
        refresh.setOnRefreshListener { reload() }
        // Only pull-to-refresh when the page itself is scrolled to the top.
        refresh.setOnChildScrollUpCallback { _, _ -> webView.scrollY > 0 }
        findViewById<Button>(R.id.retry).setOnClickListener { reload() }

        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(siteUrl)
        }
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
            // and route that address like any other link.
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
                        if (!url.isNullOrEmpty() && url != "about:blank") take(Uri.parse(url))
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
            if (policy.targetFor(request.url.toString()) == SitePolicy.Target.APP) return false
            route(request.url)
            return true
        }

        override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
            progress.visibility = View.VISIBLE
        }

        override fun onPageFinished(view: WebView, url: String?) {
            progress.visibility = View.GONE
            refresh.isRefreshing = false
            back.isEnabled = view.canGoBack()  // history is settled by now (doUpdateVisitedHistory can come too early)
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
            back.isEnabled = view.canGoBack()
        }
    
    }

    /** Open a link according to [SitePolicy]: in this WebView, in another app, or not at all. */
    private fun route(uri: Uri) {
        when (policy.targetFor(uri.toString())) {
            SitePolicy.Target.APP -> webView.loadUrl(uri.toString())
            SitePolicy.Target.BROWSER -> openElsewhere(uri)
            SitePolicy.Target.BLOCK -> Unit
        }
    }

    private fun reload() {
        mainFrameFailed = false
        val current = webView.url
        if (current.isNullOrEmpty() || current == "about:blank") webView.loadUrl(siteUrl) else webView.reload()
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
