package com.dipaknehe.stockvalue

import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/** Reads a company's filing status from the web app's API (the same cached endpoint the web page uses). */
class StatusApi(private val siteUrl: String) {

    class NotFound(ticker: String) : Exception("Unknown ticker $ticker")

    /** Blocking; call from a background thread. */
    fun fetch(ticker: String): CompanyStatus {
        val url = URL(siteUrl.trimEnd('/') + "/api/financials?ticker=" + URLEncoder.encode(ticker, "UTF-8") + "&v=$API_VERSION")
        val conn = url.openConnection() as HttpURLConnection
        try {
            conn.connectTimeout = 15_000
            conn.readTimeout = 30_000
            conn.setRequestProperty("User-Agent", "${MainActivity.USER_AGENT_TAG}/${BuildConfig.VERSION_NAME}")
            return when (val code = conn.responseCode) {
                200 -> parse(conn.inputStream.bufferedReader().use { it.readText() })
                404 -> throw NotFound(ticker)
                else -> throw IOException("HTTP $code for $ticker")
            }
        } finally {
            conn.disconnect()
        }
    }

    companion object {
        /** Must match API_VERSION in the web app (public/js/page.js), so both share the CDN cache. */
        const val API_VERSION = 5

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
