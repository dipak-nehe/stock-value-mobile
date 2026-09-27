package com.dipaknehe.stockvalue

import android.content.Context
import androidx.core.content.edit

/**
 * The watchlist, saved on the phone only (it never leaves the device), as JSON in SharedPreferences
 * (Android's small key-value storage for app settings).
 *
 * TO CHANGE HOW MANY COMPANIES CAN BE WATCHED: edit [MAX] below. Each background check asks the web app once per
 * company, so keep it modest. The "list is full" message (strings.xml: watchlist_full) shows the number itself.
 *
 * Kotlin notes: `@Synchronized` lets only one thread at a time run the function (the screen and the background
 * check can both change the list).
 */
class WatchStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("watchlist", Context.MODE_PRIVATE)

    /** Every watched company, in the order they were added. */
    fun all(): List<Watched> = WatchCodec.decode(prefs.getString(KEY, null))

    fun contains(ticker: String) = all().any { it.ticker == ticker }

    /** Adds a company; false if it's already watched or the list is full. */
    @Synchronized
    fun add(ticker: String): Boolean {
        val list = all()
        if (list.size >= MAX || list.any { it.ticker == ticker }) return false
        save(list + Watched(ticker)) // a new entry isn't "baselined" yet: its first check only records what exists
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

    // `commit = true` writes to disk immediately (the background check may run in the next moment).
    private fun save(list: List<Watched>) = prefs.edit(commit = true) { putString(KEY, WatchCodec.encode(list)) }

    // `companion object` holds class-level constants (like Java's `static final`).
    companion object {
        private const val KEY = "watched"

        /** Each check asks the web app once per company; keep that modest. */
        const val MAX = 25
    }
}
