package com.dipaknehe.stockvalue

/**
 * The web app's address, used everywhere the app needs it.
 *
 * TO CHANGE THE SITE: edit `SITE_URL` in app/build.gradle.kts (not here). Release builds always use that.
 * Debug builds can be pointed at another server (the tests use a local one) through [debugOverride].
 *
 * Kotlin notes: an `object` is a single shared instance (like a Java class with only static members).
 */
object Site {
    // `String?` means "a String or null". @Volatile: safe to read from the background check's thread.
    @Volatile var debugOverride: String? = null

    // A computed property: re-evaluated on every read.
    // `a?.takeIf { cond }` gives `a` only if `cond` is true, else null; `x ?: y` means "x, or y if x is null".
    val url: String get() = debugOverride?.takeIf { BuildConfig.DEBUG } ?: BuildConfig.SITE_URL
}
