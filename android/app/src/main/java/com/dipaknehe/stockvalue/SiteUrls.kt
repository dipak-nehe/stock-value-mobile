package com.dipaknehe.stockvalue

import java.net.URI
import java.net.URISyntaxException
import java.net.URLDecoder
import java.net.URLEncoder

/** Addresses of pages in the web app. Pure Kotlin, unit-tested on the JVM. */
object SiteUrls {
    private val TICKER = Regex("^[A-Z0-9.\\-]{1,10}$")

    /** The ticker shown by a results page (`/?t=KO`), or null for the start page, the compare page or another site. */
    fun tickerOf(url: String?, siteUrl: String): String? {
        if (url == null || SitePolicy(siteUrl).targetFor(url) != SitePolicy.Target.APP) return null
        val uri = try {
            URI(url)
        } catch (_: URISyntaxException) {
            return null
        }
        val path = uri.path.orEmpty()
        if (path != "" && path != "/" && path != "/index.html") return null
        val t = query(uri.rawQuery)["t"]?.trim()?.uppercase() ?: return null
        return t.takeIf { TICKER.matches(it) }
    }

    /** The results page for a ticker, optionally opened on a tab (e.g. "history"). */
    fun results(siteUrl: String, ticker: String, tab: String? = null): String =
        siteUrl.trimEnd('/') + "/?t=" + URLEncoder.encode(ticker, "UTF-8") + (tab?.let { "#$it" } ?: "")

    private fun query(raw: String?): Map<String, String> =
        raw.orEmpty().split("&").filter { it.isNotEmpty() }.associate { pair ->
            val (k, v) = (pair.split("=", limit = 2) + "").take(2)
            URLDecoder.decode(k, "UTF-8") to URLDecoder.decode(v, "UTF-8")
        }
}
