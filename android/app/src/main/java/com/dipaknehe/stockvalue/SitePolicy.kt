package com.dipaknehe.stockvalue

import java.net.URI
import java.net.URISyntaxException

/**
 * Decides where a link opens: pages of the web app stay in the app, other web and mail links open in
 * the phone's browser or mail app, and anything else (javascript:, intent:, file:, …) is blocked.
 * Plain Kotlin with no Android types, so it's unit-tested on the JVM (SitePolicyTest).
 *
 * TO LET ANOTHER KIND OF LINK OPEN ELSEWHERE (e.g. "tel:" phone numbers): add its scheme to the BROWSER line in
 * [targetFor], and add a case to SitePolicyTest. Everything not listed stays blocked, which is the safe default.
 *
 * Kotlin notes: `class SitePolicy(siteUrl: String)` declares the constructor in the class header.
 */
class SitePolicy(siteUrl: String) {
    /** The three possible outcomes for a link. */
    enum class Target { APP, BROWSER, BLOCK }

    private val site = URI(siteUrl)

    fun targetFor(url: String): Target {
        val uri = try {
            URI(url)
        } catch (_: URISyntaxException) {
            return Target.BLOCK // not a valid address
        }
        val scheme = uri.scheme?.lowercase() ?: return Target.BLOCK // e.g. a relative path
        // `when` is Kotlin's switch: the first true branch wins.
        return when {
            isSameSite(uri, scheme) -> Target.APP
            scheme == "https" || scheme == "http" || scheme == "mailto" -> Target.BROWSER
            else -> Target.BLOCK
        }
    }

    // Same scheme, host (any letter case) and port as the web app. Lookalike hosts such as
    // "stock-value-analysis.vercel.app.example.com" don't match, and neither does plain http.
    private fun isSameSite(uri: URI, scheme: String) =
        scheme == site.scheme.lowercase() &&
            uri.host != null && uri.host.equals(site.host, ignoreCase = true) &&
            port(uri) == port(site)

    // An address without a port uses the default: 443 for https, 80 for http.
    private fun port(uri: URI) = when {
        uri.port != -1 -> uri.port
        uri.scheme.equals("https", ignoreCase = true) -> 443
        else -> 80
    }
}
