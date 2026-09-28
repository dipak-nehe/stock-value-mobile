package com.dipaknehe.stockvalue

// The data the filing alerts work with, and the rules that decide what's new.
//
// Kotlin notes: a `data class` is a small value type; Kotlin writes its constructor, getters, equals/hashCode,
// toString and copy() for you. `val` fields can't be changed after creation (use copy(...) to get a changed one).

/** The newest annual or quarterly report (10-K, 10-Q, 20-F, 40-F or an amendment), from the API's `latestReport`. */
data class Report(val form: String, val date: String, val accession: String, val url: String)

/** One notable filing from the API's `secHistory.events` (e.g. type "late_filing", form "NT 10-K"). */
data class FilingEvent(val date: String, val type: String, val form: String, val url: String) {
    /** Identifies the filing, so the same one is never announced twice. */
    val key: String get() = "$date|$type|$form|$url"
}

/** What the API currently says about a company, as far as alerts are concerned. */
data class CompanyStatus(val ticker: String, val name: String, val report: Report?, val events: List<FilingEvent>)

/**
 * A watched company and what was already seen at the last check. [baselined] is false until the first successful
 * check: that check only records the current state, so watching a company never alerts about old filings.
 * The `= null` / `= false` parts are default values, so `Watched("KO")` is a valid new entry.
 */
data class Watched(
    val ticker: String,
    val name: String? = null,
    val report: Report? = null,
    val seenEvents: Set<String> = emptySet(),
    val baselined: Boolean = false,
    val lastChecked: Long? = null,
)

/**
 * A notification to post. `sealed` means these two are the only kinds, so a `when` over an Alert
 * (see AlertNotifier) must handle both, and the compiler tells you if a new kind is added and not handled.
 */
sealed interface Alert {
    val ticker: String
    val name: String

    data class NewReport(override val ticker: String, override val name: String, val report: Report) : Alert
    data class Warning(override val ticker: String, override val name: String, val event: FilingEvent) : Alert
}

/** Decides which notifications a check produces. Pure logic, unit-tested on the JVM (AlertRulesTest). */
object AlertRules {
    /**
     * Warnings worth a notification: restatement warnings, auditor changes, late-filing notices, amended annual reports.
     *
     * TO ALERT ON MORE (OR FEWER) KINDS OF FILINGS: edit this set. The possible types come from the web app's
     * backend (_classify_filing in backend/stock_data.py): non_reliance, auditor_change, late_filing, amendment,
     * bankruptcy, delisting_notice, cyber_incident, impairment, acquisition, sec_letter, company_response.
     * Acquisitions and SEC letters are routine, so they're recorded but never announced. A new type also needs its notification text: a case in
     * AlertNotifier.warningText and strings in res/values/strings.xml and res/values-es/strings.xml.
     * Then update AlertRulesTest ("onlyTheAgreedTypesCountAsSerious").
     */
    val SERIOUS = setOf(
        "non_reliance", "auditor_change", "late_filing", "amendment",
        "bankruptcy", "delisting_notice", "cyber_incident", "impairment",
    )

    /** Returns the updated watch state and the alerts to post (a Pair, written `a to b`). */
    fun check(before: Watched, now: CompanyStatus, checkedAt: Long): Pair<Watched, List<Alert>> {
        // The state to save after this check: copy() keeps every field except the ones named here.
        val updated = before.copy(
            name = now.name,
            report = now.report ?: before.report,
            seenEvents = before.seenEvents + now.events.map { it.key },
            baselined = true,
            lastChecked = checkedAt,
        )
        // First check after watching: just remember what exists today, don't alert about it.
        if (!before.baselined) return updated to emptyList()

        val alerts = mutableListOf<Alert>()
        // A new annual/quarterly report: a different accession number, and not older than the one we knew.
        val report = now.report
        val previous = before.report
        if (report != null && report.accession != previous?.accession && (previous == null || report.date >= previous.date)) {
            alerts += Alert.NewReport(now.ticker, now.name, report)
        }
        // New serious warnings we haven't seen before, oldest first.
        now.events
            .filter { it.type in SERIOUS && it.key !in before.seenEvents }
            .sortedBy { it.date }
            .forEach { alerts += Alert.Warning(now.ticker, now.name, it) }
        return updated to alerts
    }
}
