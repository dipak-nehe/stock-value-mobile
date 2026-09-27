package com.dipaknehe.stockvalue

import java.net.URI
import java.net.URISyntaxException

/**
 * Decides where a link opens: pages of the web app stay in the app, other web and mail links open in
 * the phone's browser or mail app, and anything else (javascript:, intent:, file:, …) is blocked.
 * Plain Kotlin with no Android types, so it's unit-tested on the JVM.
 */
class SitePolicy(siteUrl: String) {
    enum class Target { APP, BROWSER, BLOCK }

    private val site = URI(siteUrl)

    fun targetFor(url: String): Target {
        val uri = try {
            URI(url)
        } catch (_: URISyntaxException) {
            return Target.BLOCK
        }
        val scheme = uri.scheme?.lowercase() ?: return Target.BLOCK
        return when {
            isSameSite(uri, scheme) -> Target.APP
            scheme == "https" || scheme == "http" || scheme == "mailto" -> Target.BROWSER
            else -> Target.BLOCK
        }
    }

    private fun isSameSite(uri: URI, scheme: String) =
        scheme == site.scheme.lowercase() &&
            uri.host != null && uri.host.equals(site.host, ignoreCase = true) &&
            port(uri) == port(site)

    private fun port(uri: URI) = when {
        uri.port != -1 -> uri.port
        uri.scheme.equals("https", ignoreCase = true) -> 443
        else -> 80
    }
}
