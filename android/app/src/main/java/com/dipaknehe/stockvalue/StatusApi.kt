package com.dipaknehe.stockvalue

import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * Reads a company's filing status from the web app's API: the same cached endpoint the web page uses
 * (/api/financials?ticker=KO&v=5), so the app never talks to SEC directly.
 *
 * Only two parts of the response are used: `latestReport` (the newest 10-K/10-Q/20-F/40-F) and
 * `secHistory.events` (restatement warnings, late filings, …). See [parse].
 *
 * `private val siteUrl` in the header both takes the constructor argument and keeps it as a property.
 */
class StatusApi(private val siteUrl: String) {

    /** The web app doesn't know this ticker (HTTP 404). The check skips it and carries on. */
    class NotFound(ticker: String) : Exception("Unknown ticker $ticker")

    /** Blocking network call; only call it from a background thread (the WorkManager check does). */
    fun fetch(ticker: String): CompanyStatus {
        // "$API_VERSION" inside a string inserts the value (a string template).
        val url = URL(siteUrl.trimEnd('/') + "/api/financials?ticker=" + URLEncoder.encode(ticker, "UTF-8") + "&v=$API_VERSION")
        val conn = url.openConnection() as HttpURLConnection
        try {
            // TO CHANGE THE TIMEOUTS: milliseconds (15 s to connect, 30 s to read; a first lookup can take a few seconds).
            conn.connectTimeout = 15_000
            conn.readTimeout = 30_000
            conn.setRequestProperty("User-Agent", "${MainActivity.USER_AGENT_TAG}/${BuildConfig.VERSION_NAME}")
            // `when (val code = …)` stores the value and switches on it in one go.
            return when (val code = conn.responseCode) {
                200 -> parse(conn.inputStream.bufferedReader().use { it.readText() })
                404 -> throw NotFound(ticker)
                else -> throw IOException("HTTP $code for $ticker") // the check retries these later
            }
        } finally {
            conn.disconnect()
        }
    }

    companion object {
        /**
         * Must match API_VERSION in the web app (public/js/page.js), so both share the CDN cache and the app sees
         * the fields it reads. When the web app bumps its version, change this too (JsonTest checks the number).
         */
        const val API_VERSION = 5

        /** Reads the parts of the API's JSON that alerts need. Unit-tested in JsonTest with a real response. */
        fun parse(json: String): CompanyStatus {
            val d = JSONObject(json)
            val report = d.optJSONObject("latestReport")?.let {
                Report(it.getString("form"), it.getString("date"), it.getString("accession"), it.optString("url"))
            }
            val events = d.optJSONObject("secHistory")?.optJSONArray("events") ?: JSONArray()
            return CompanyStatus(
                ticker = d.getString("ticker"),
                name = d.optString("name", d.getString("ticker")),
                report = report,
                events = (0 until events.length()).map { i ->
                    val e = events.getJSONObject(i)
                    FilingEvent(e.getString("date"), e.getString("type"), e.optString("form"), e.optString("url"))
                },
            )
        }
    }
}
