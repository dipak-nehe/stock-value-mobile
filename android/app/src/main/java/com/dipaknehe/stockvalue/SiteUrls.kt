package com.dipaknehe.stockvalue

import java.net.URI
import java.net.URISyntaxException
import java.net.URLDecoder
import java.net.URLEncoder

/**
 * Addresses of pages in the web app: "which company is this page showing?" and "build the page for company X".
 * Used by the Watch star (it only appears on a company's page) and by notifications and the Watchlist (to open one).
 * Plain Kotlin with no Android types, so it's unit-tested on a normal JVM (SiteUrlsTest).
 */
object SiteUrls {
    // What a ticker may look like: 1–10 capital letters, digits, dots or dashes (e.g. KO, BRK.B, BF-B).
    private val TICKER = Regex("^[A-Z0-9.\\-]{1,10}$")

    /**
     * The ticker shown by a results page (`/?t=KO` → "KO"), or null for the start page, the compare page,
     * another website, or anything that doesn't look like a ticker.
     */
    fun tickerOf(url: String?, siteUrl: String): String? {
        // Only pages of our own web app count.
        if (url == null || SitePolicy(siteUrl).targetFor(url) != SitePolicy.Target.APP) return null
        // `try` is an expression in Kotlin: its value is the parsed URI, or we return early on a bad address.
        val uri = try {
            URI(url)
        } catch (_: URISyntaxException) {
            return null
        }
        // Results pages are the site root (or /index.html); compare.html and others have no Watch star.
        val path = uri.path.orEmpty()
        if (path != "" && path != "/" && path != "/index.html") return null
        // `?.` calls only when the value isn't null; `?: return null` leaves the function when it is.
        val t = query(uri.rawQuery)["t"]?.trim()?.uppercase() ?: return null
        return t.takeIf { TICKER.matches(it) }
    }

    /**
     * The results page for a ticker, optionally opened on a tab: results(site, "SMCI", "history")
     * → "https://…/?t=SMCI#history". Tab names are the web app's: overview, flags, history, value, charts, data.
     */
    fun results(siteUrl: String, ticker: String, tab: String? = null): String =
        siteUrl.trimEnd('/') + "/?t=" + URLEncoder.encode(ticker, "UTF-8") + (tab?.let { "#$it" } ?: "")

    // Turns "t=KO&lang=es" into a map {t=KO, lang=es}. `a to b` makes a pair (key to value).
    private fun query(raw: String?): Map<String, String> =
        raw.orEmpty().split("&").filter { it.isNotEmpty() }.associate { pair ->
            val (k, v) = (pair.split("=", limit = 2) + "").take(2)
            URLDecoder.decode(k, "UTF-8") to URLDecoder.decode(v, "UTF-8")
        }
}
