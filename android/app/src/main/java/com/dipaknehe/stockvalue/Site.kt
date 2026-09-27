package com.dipaknehe.stockvalue

/** The web app's address. Debug builds can point at a local server (the instrumented tests do). */
object Site {
    @Volatile var debugOverride: String? = null

    val url: String get() = debugOverride?.takeIf { BuildConfig.DEBUG } ?: BuildConfig.SITE_URL
}
