package com.dipaknehe.stockvalue

import android.content.Intent
import android.os.Bundle
import android.text.format.DateUtils
import android.view.LayoutInflater
import android.view.View
import android.widget.Button
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import android.widget.Toolbar
import androidx.activity.ComponentActivity
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import androidx.work.WorkInfo
import androidx.work.WorkManager

/** The watched companies: latest report, last check, open or remove each, and "Check now". */
class WatchlistActivity : ComponentActivity() {
    private lateinit var store: WatchStore
    private lateinit var rows: LinearLayout
    private lateinit var empty: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_watchlist)
        store = WatchStore(this)
        rows = findViewById(R.id.rows)
        empty = findViewById(R.id.empty)

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.root)) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            view.updatePadding(left = bars.left, top = bars.top, right = bars.right, bottom = bars.bottom)
            WindowInsetsCompat.CONSUMED
        }
        findViewById<Toolbar>(R.id.toolbar).setNavigationOnClickListener { finish() }
        findViewById<Button>(R.id.checkNow).setOnClickListener {
            FilingChecks.checkNow(this)
            Toast.makeText(this, R.string.checking, Toast.LENGTH_SHORT).show()
        }
        // Refresh the list when a check finishes.
        WorkManager.getInstance(this).getWorkInfosForUniqueWorkLiveData(FilingChecks.NOW).observe(this) { infos ->
            if (infos.any { it.state == WorkInfo.State.SUCCEEDED || it.state == WorkInfo.State.FAILED }) render()
        }
    }

    override fun onResume() {
        super.onResume()
        render()
    }

    private fun render() {
        val list = store.all()
        empty.visibility = if (list.isEmpty()) View.VISIBLE else View.GONE
        findViewById<Button>(R.id.checkNow).isEnabled = list.isNotEmpty()
        rows.removeAllViews()
        val inflater = LayoutInflater.from(this)
        for (w in list) {
            val row = inflater.inflate(R.layout.row_watched, rows, false)
            row.findViewById<TextView>(R.id.company).text =
                if (w.name != null) getString(R.string.company_line, w.name, w.ticker) else w.ticker
            row.findViewById<TextView>(R.id.detail).text = detail(w)
            row.setOnClickListener {
                startActivity(
                    Intent(this, MainActivity::class.java)
                        .putExtra(MainActivity.EXTRA_OPEN_URL, SiteUrls.results(Site.url, w.ticker))
                        .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP),
                )
            }
            row.findViewById<ImageButton>(R.id.remove).apply {
                contentDescription = getString(R.string.remove_ticker, w.ticker)
                setOnClickListener {
                    store.remove(w.ticker)
                    FilingChecks.sync(this@WatchlistActivity)
                    render()
                }
            }
            rows.addView(row)
        }
    }

    private fun detail(w: Watched): String {
        val report = w.report?.let { getString(R.string.latest_report, it.form, it.date) }
            ?: getString(if (w.baselined) R.string.no_report else R.string.waiting_first_check)
        val checked = w.lastChecked?.let {
            getString(R.string.last_checked, DateUtils.getRelativeTimeSpanString(it, System.currentTimeMillis(), DateUtils.MINUTE_IN_MILLIS))
        }
        return listOfNotNull(report, checked).joinToString("\n")
    }
}
