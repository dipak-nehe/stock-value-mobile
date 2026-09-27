package com.dipaknehe.stockvalue

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Schedules the background filing checks: about twice a day, only when online, only while something is watched.
 * WorkManager (Android's job scheduler) runs them even if the app is closed, and survives phone restarts;
 * Android picks the exact time (it may wait longer on battery saver).
 */
object FilingChecks {
    // Names for the scheduled jobs, so a new request replaces or keeps the existing one instead of adding another.
    const val PERIODIC = "filing-checks"
    const val NOW = "filing-check-now"

    // Only run when the phone has internet.
    private val online = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    /** Start the repeating check when something is watched; stop it when the watchlist is empty. */
    fun sync(context: Context) {
        val work = WorkManager.getInstance(context)
        if (WatchStore(context).all().isEmpty()) {
            work.cancelUniqueWork(PERIODIC)
        } else {
            work.enqueueUniquePeriodicWork(
                PERIODIC,
                // KEEP: if the check is already scheduled, leave its timing alone.
                // (After changing the interval below, use UPDATE here once, or reinstall the app, to reschedule.)
                ExistingPeriodicWorkPolicy.KEEP,
                // TO CHANGE HOW OFTEN COMPANIES ARE CHECKED: edit "12, TimeUnit.HOURS". Android's minimum is 15 minutes.
                PeriodicWorkRequestBuilder<FilingCheckWorker>(12, TimeUnit.HOURS).setConstraints(online).build(),
            )
        }
    }

    /** Check right away, e.g. to record the starting point of a newly watched company, or from "Check now". */
    fun checkNow(context: Context) {
        WorkManager.getInstance(context).enqueueUniqueWork(
            NOW,
            ExistingWorkPolicy.REPLACE, // a new "check now" replaces one that hasn't run yet
            OneTimeWorkRequestBuilder<FilingCheckWorker>().setConstraints(online).build(),
        )
    }
}

/**
 * One check: asks the web app about each watched company and posts a notification for anything new.
 * `: Worker(context, params)` means this class extends WorkManager's Worker; doWork() runs on a background thread.
 */
class FilingCheckWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

    override fun doWork(): Result {
        val site = inputData.getString(KEY_SITE_URL)?.takeIf { BuildConfig.DEBUG } ?: Site.url
        val store = WatchStore(applicationContext)
        val api = StatusApi(site)
        val notifier = AlertNotifier(applicationContext, site)
        var failed = false // `var` can change; `val` can't
        for (watched in store.all()) {
            val status = try {
                api.fetch(watched.ticker)
            } catch (_: StatusApi.NotFound) {
                continue // unknown ticker: skip it, keep checking the others
            } catch (_: IOException) {
                failed = true // network problem: remember to retry
                continue
            } catch (_: org.json.JSONException) {
                failed = true // unexpected response: retry too
                continue
            }
            // Decide what's new, save the new state, then notify. `val (a, b) = pair` unpacks a Pair.
            val (updated, alerts) = AlertRules.check(watched, status, System.currentTimeMillis())
            store.update(updated)
            alerts.forEach(notifier::post) // `notifier::post` passes the function itself, like a Java method reference
        }
        // A network hiccup: try again later (companies already checked won't alert twice).
        // TO CHANGE THE NUMBER OF RETRIES: edit the 3.
        return if (failed && runAttemptCount < 3) Result.retry() else Result.success()
    }

    companion object {
        /** Debug builds only: check against this address instead of the live site (used by the tests). */
        const val KEY_SITE_URL = "site_url"
    }
}
