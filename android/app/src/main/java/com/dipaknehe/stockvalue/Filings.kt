package com.dipaknehe.stockvalue

/** The newest annual or quarterly report (10-K, 10-Q, 20-F, 40-F or an amendment), from the API's `latestReport`. */
data class Report(val form: String, val date: String, val accession: String, val url: String)

/** One notable filing from the API's `secHistory.events`. */
data class FilingEvent(val date: String, val type: String, val form: String, val url: String) {
    val key: String get() = "$date|$type|$form|$url"
}

/** What the API currently says about a company, as far as alerts are concerned. */
data class CompanyStatus(val ticker: String, val name: String, val report: Report?, val events: List<FilingEvent>)

/**
 * A watched company and what was already seen at the last check. [baselined] is false until the first successful
 * check: that check only records the current state, so watching a company never alerts about old filings.
 */
data class Watched(
    val ticker: String,
    val name: String? = null,
    val report: Report? = null,
    val seenEvents: Set<String> = emptySet(),
    val baselined: Boolean = false,
    val lastChecked: Long? = null,
)

sealed interface Alert {
    val ticker: String
    val name: String

    data class NewReport(override val ticker: String, override val name: String, val report: Report) : Alert
    data class Warning(override val ticker: String, override val name: String, val event: FilingEvent) : Alert
}

/** Decides which notifications a check produces. Pure logic, unit-tested on the JVM. */
object AlertRules {
    /** Warnings worth a notification: restatement warnings, auditor changes, late-filing notices, amended annual reports. */
    val SERIOUS = setOf("non_reliance", "auditor_change", "late_filing", "amendment")

    /** Returns the updated watch state and the alerts to post. */
    fun check(before: Watched, now: CompanyStatus, checkedAt: Long): Pair<Watched, List<Alert>> {
        val updated = before.copy(
            name = now.name,
            report = now.report ?: before.report,
            seenEvents = before.seenEvents + now.events.map { it.key },
            baselined = true,
            lastChecked = checkedAt,
        )
        if (!before.baselined) return updated to emptyList()

        val alerts = mutableListOf<Alert>()
        val report = now.report
        val previous = before.report
        if (report != null && report.accession != previous?.accession && (previous == null || report.date >= previous.date)) {
            alerts += Alert.NewReport(now.ticker, now.name, report)
        }
        now.events
            .filter { it.type in SERIOUS && it.key !in before.seenEvents }
            .sortedBy { it.date }
            .forEach { alerts += Alert.Warning(now.ticker, now.name, it) }
        return updated to alerts
    }
}
