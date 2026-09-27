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

/** Schedules the background filing checks: about twice a day, only when online, only while something is watched. */
object FilingChecks {
    const val PERIODIC = "filing-checks"
    const val NOW = "filing-check-now"

    private val online = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    fun sync(context: Context) {
        val work = WorkManager.getInstance(context)
        if (WatchStore(context).all().isEmpty()) {
            work.cancelUniqueWork(PERIODIC)
        } else {
            work.enqueueUniquePeriodicWork(
                PERIODIC,
                ExistingPeriodicWorkPolicy.KEEP,
                PeriodicWorkRequestBuilder<FilingCheckWorker>(12, TimeUnit.HOURS).setConstraints(online).build(),
            )
        }
    }

    /** Check right away, e.g. to record the starting point of a newly watched company. */
    fun checkNow(context: Context) {
        WorkManager.getInstance(context).enqueueUniqueWork(
            NOW,
            ExistingWorkPolicy.REPLACE,
            OneTimeWorkRequestBuilder<FilingCheckWorker>().setConstraints(online).build(),
        )
    }
}

/** Asks the web app about each watched company and posts a notification for anything new. */
class FilingCheckWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

    override fun doWork(): Result {
        val site = inputData.getString(KEY_SITE_URL)?.takeIf { BuildConfig.DEBUG } ?: Site.url
        val store = WatchStore(applicationContext)
        val api = StatusApi(site)
        val notifier = AlertNotifier(applicationContext, site)
        var failed = false
        for (watched in store.all()) {
            val status = try {
                api.fetch(watched.ticker)
            } catch (_: StatusApi.NotFound) {
                continue
            } catch (_: IOException) {
                failed = true
                continue
            } catch (_: org.json.JSONException) {
                failed = true
                continue
            }
            val (updated, alerts) = AlertRules.check(watched, status, System.currentTimeMillis())
            store.update(updated)
            alerts.forEach(notifier::post)
        }
        // A network hiccup: try again later (companies already checked won't alert twice).
        return if (failed && runAttemptCount < 3) Result.retry() else Result.success()
    }

    companion object {
        /** Debug builds only: check against this address instead of the live site (used by the tests). */
        const val KEY_SITE_URL = "site_url"
    }
}
