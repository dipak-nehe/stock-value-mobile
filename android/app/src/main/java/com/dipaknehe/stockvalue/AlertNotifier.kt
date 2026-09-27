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

/** Posts filing alerts. Tapping one opens the company's analysis (the SEC history tab for warnings). */
class AlertNotifier(private val context: Context, private val siteUrl: String) {

    fun post(alert: Alert) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        ensureChannel(context)
        val (text, tab) = when (alert) {
            is Alert.NewReport -> context.getString(R.string.alert_new_report, alert.report.form, alert.report.date) to null
            is Alert.Warning -> warningText(alert.event) to "history"
        }
        val title = context.getString(
            if (alert is Alert.Warning) R.string.alert_title_warning else R.string.alert_title, alert.name, alert.ticker,
        )
        val open = Intent(context, MainActivity::class.java)
            .putExtra(MainActivity.EXTRA_OPEN_URL, SiteUrls.results(siteUrl, alert.ticker, tab))
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val id = idFor(alert)
        val notification = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_alert)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setAutoCancel(true)
            .setContentIntent(PendingIntent.getActivity(context, id, open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
            .build()
        try {
            NotificationManagerCompat.from(context).notify(id, notification)
        } catch (_: SecurityException) {
            // Permission withdrawn between the check above and now: nothing to show.
        }
    }

    private fun warningText(e: FilingEvent) = when (e.type) {
        "late_filing" -> context.getString(R.string.alert_late_filing, e.form)
        "non_reliance" -> context.getString(R.string.alert_non_reliance)
        "auditor_change" -> context.getString(R.string.alert_auditor_change)
        "amendment" -> context.getString(R.string.alert_amendment, e.form)
        else -> e.form
    }

    private fun idFor(alert: Alert) = when (alert) {
        is Alert.NewReport -> "${alert.ticker}|report|${alert.report.accession}"
        is Alert.Warning -> "${alert.ticker}|${alert.event.key}"
    }.hashCode()

    companion object {
        const val CHANNEL = "filing_alerts"

        fun ensureChannel(context: Context) {
            val channel = NotificationChannel(CHANNEL, context.getString(R.string.channel_alerts), NotificationManager.IMPORTANCE_DEFAULT)
            channel.description = context.getString(R.string.channel_alerts_description)
            context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }
}
