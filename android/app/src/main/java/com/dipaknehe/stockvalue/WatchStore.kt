package com.dipaknehe.stockvalue

import android.content.Context
import androidx.core.content.edit

/** The watchlist, kept on the phone only (it never leaves the device). */
class WatchStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("watchlist", Context.MODE_PRIVATE)

    fun all(): List<Watched> = WatchCodec.decode(prefs.getString(KEY, null))

    fun contains(ticker: String) = all().any { it.ticker == ticker }

    /** Adds a company; false if it's already watched or the list is full. */
    @Synchronized
    fun add(ticker: String): Boolean {
        val list = all()
        if (list.size >= MAX || list.any { it.ticker == ticker }) return false
        save(list + Watched(ticker))
        return true
    }

    @Synchronized
    fun remove(ticker: String) = save(all().filterNot { it.ticker == ticker })

    /** Saves a check result, unless the company was removed while the check ran. */
    @Synchronized
    fun update(watched: Watched) {
        val list = all()
        if (list.none { it.ticker == watched.ticker }) return
        save(list.map { if (it.ticker == watched.ticker) watched else it })
    }

    @Synchronized
    fun clear() = prefs.edit(commit = true) { remove(KEY) }

    private fun save(list: List<Watched>) = prefs.edit(commit = true) { putString(KEY, WatchCodec.encode(list)) }

    companion object {
        private const val KEY = "watched"

        /** Each check asks the web app once per company; keep that modest. */
        const val MAX = 25
    }
}
