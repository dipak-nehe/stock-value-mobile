package com.dipaknehe.stockvalue

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/**
 * Posts filing alerts. Tapping one opens the company's analysis (the SEC history tab for warnings).
 *
 * TO CHANGE THE NOTIFICATION TEXT: edit the alert_* strings in res/values/strings.xml (English) and
 * res/values-es/strings.xml (Spanish); %1$s / %2$s are filled in by the getString(...) calls below.
 * TO CHANGE THE ICON: res/drawable/ic_stat_alert.xml (white shape on transparent; Android colours it).
 */
class AlertNotifier(private val context: Context, private val siteUrl: String) {

    fun post(alert: Alert) {
        // Android 13+ needs the user's permission to show notifications; without it, silently do nothing.
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        ensureChannel(context)
        // `is` checks the kind of alert (and lets us use its fields). The result is a pair: the text, and which tab
        // to open (null = the default Overview tab).
        val (text, tab) = when (alert) {
            is Alert.NewReport -> context.getString(R.string.alert_new_report, alert.report.form, alert.report.date) to null
            is Alert.Warning -> warningText(alert.event) to "history"
        }
        val title = context.getString(
            if (alert is Alert.Warning) R.string.alert_title_warning else R.string.alert_title, alert.name, alert.ticker,
        )
        // What happens on tap: open the main screen on the company's page (reusing the screen if it's already open).
        val open = Intent(context, MainActivity::class.java)
            .putExtra(MainActivity.EXTRA_OPEN_URL, SiteUrls.results(siteUrl, alert.ticker, tab))
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val id = idFor(alert)
        val notification = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_alert)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text)) // show the whole text when expanded
            .setAutoCancel(true) // disappears once tapped
            // Each alert is its own group: otherwise Android bundles an app's notifications into a summary whose
            // tap opens the app's start page instead of the company.
            .setGroup("alert-$id")
            .setContentIntent(PendingIntent.getActivity(context, id, open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
            .build()
        try {
            NotificationManagerCompat.from(context).notify(id, notification)
        } catch (_: SecurityException) {
            // Permission withdrawn between the check above and now: nothing to show.
        }
    }

    // The sentence for each kind of warning (see AlertRules.SERIOUS for which kinds alert at all).
    private fun warningText(e: FilingEvent) = when (e.type) {
        "late_filing" -> context.getString(R.string.alert_late_filing, e.form)
        "non_reliance" -> context.getString(R.string.alert_non_reliance)
        "auditor_change" -> context.getString(R.string.alert_auditor_change)
        "amendment" -> context.getString(R.string.alert_amendment, e.form)
        "bankruptcy" -> context.getString(R.string.alert_bankruptcy)
        "delisting_notice" -> context.getString(R.string.alert_delisting_notice)
        "cyber_incident" -> context.getString(R.string.alert_cyber_incident)
        "impairment" -> context.getString(R.string.alert_impairment)
        else -> e.form
    }

    // A stable number per filing, so the same alert replaces itself instead of appearing twice.
    private fun idFor(alert: Alert) = when (alert) {
        is Alert.NewReport -> "${alert.ticker}|report|${alert.report.accession}"
        is Alert.Warning -> "${alert.ticker}|${alert.event.key}"
    }.hashCode()

    companion object {
        const val CHANNEL = "filing_alerts"

        /**
         * The "Filing alerts" channel people see in Android's notification settings (they can mute it there).
         * TO MAKE ALERTS MORE PROMINENT: use IMPORTANCE_HIGH (shows a pop-up). Android only applies a channel's
         * importance when it's first created, so reinstall the app (or rename CHANNEL) to see a change.
         */
        fun ensureChannel(context: Context) {
            val channel = NotificationChannel(CHANNEL, context.getString(R.string.channel_alerts), NotificationManager.IMPORTANCE_DEFAULT)
            channel.description = context.getString(R.string.channel_alerts_description)
            context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }
}
