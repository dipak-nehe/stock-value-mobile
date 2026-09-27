package com.dipaknehe.stockvalue

import org.json.JSONArray
import org.json.JSONObject

/**
 * Turns the watchlist into JSON text and back, so [WatchStore] can save it. Kept separate from WatchStore
 * so it's unit-tested without Android (JsonTest).
 *
 * IF YOU ADD A FIELD to [Watched] (Filings.kt): write it in [encode], read it in [decode] with a default for lists
 * saved before the change (like `optBoolean("baselined", false)`), and extend the round-trip test in JsonTest.
 */
object WatchCodec {
    // `JSONArray().apply { … }` builds the array and runs the block on it (`put` means `this.put`).
    fun encode(list: List<Watched>): String = JSONArray().apply {
        list.forEach { w ->
            put(JSONObject().apply {
                put("ticker", w.ticker)
                put("name", w.name ?: JSONObject.NULL)
                put("report", w.report?.let { r ->
                    JSONObject().put("form", r.form).put("date", r.date).put("accession", r.accession).put("url", r.url)
                } ?: JSONObject.NULL)
                put("seenEvents", JSONArray(w.seenEvents.sorted()))
                put("baselined", w.baselined)
                put("lastChecked", w.lastChecked ?: JSONObject.NULL)
            })
        }
    }.toString()

    fun decode(json: String?): List<Watched> {
        if (json.isNullOrBlank()) return emptyList() // nothing saved yet
        val a = JSONArray(json)
        // `(0 until n).map { i -> … }` loops i = 0..n-1 and collects the results into a list.
        return (0 until a.length()).map { i ->
            val o = a.getJSONObject(i)
            val seen = o.optJSONArray("seenEvents") ?: JSONArray()
            // Named arguments (`ticker = …`) make the constructor call readable; order doesn't matter.
            Watched(
                ticker = o.getString("ticker"),
                name = if (o.isNull("name")) null else o.getString("name"),
                report = if (o.isNull("report")) null else o.getJSONObject("report").let {
                    Report(it.getString("form"), it.getString("date"), it.getString("accession"), it.optString("url"))
                },
                seenEvents = (0 until seen.length()).map { seen.getString(it) }.toSet(),
                baselined = o.optBoolean("baselined", false),
                lastChecked = if (o.isNull("lastChecked")) null else o.getLong("lastChecked"),
            )
        }
    }
}
