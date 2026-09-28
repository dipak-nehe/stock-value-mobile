package com.dipaknehe.stockvalue

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AlertRulesTest {
    private val q2 = Report("10-Q", "2026-04-28", "0001-26-000010", "https://sec/q2")
    private val q3 = Report("10-Q", "2026-07-29", "0001-26-000020", "https://sec/q3")
    private val letter = FilingEvent("2026-05-01", "sec_letter", "UPLOAD", "https://sec/letter")
    private val late = FilingEvent("2026-08-15", "late_filing", "NT 10-K", "https://sec/nt")
    private val auditor = FilingEvent("2026-08-20", "auditor_change", "8-K", "https://sec/8k")

    private fun status(report: Report?, vararg events: FilingEvent) = CompanyStatus("KO", "COCA COLA CO", report, events.toList())
    private fun baselined(report: Report?, vararg seen: FilingEvent) =
        Watched("KO", "COCA COLA CO", report, seen.map { it.key }.toSet(), baselined = true, lastChecked = 1L)

    @Test
    fun theFirstCheckOnlyRecordsTheStartingPoint() {
        val (updated, alerts) = AlertRules.check(Watched("KO"), status(q3, late, letter), checkedAt = 100L)
        assertEquals(emptyList<Alert>(), alerts)                      // no alerts about filings from before watching
        assertTrue(updated.baselined)
        assertEquals(q3, updated.report)
        assertEquals(setOf(late.key, letter.key), updated.seenEvents)
        assertEquals("COCA COLA CO", updated.name)
        assertEquals(100L, updated.lastChecked)
    }

    @Test
    fun nothingNewMeansNoAlerts() {
        val (updated, alerts) = AlertRules.check(baselined(q3, late), status(q3, late), 200L)
        assertEquals(emptyList<Alert>(), alerts)
        assertEquals(200L, updated.lastChecked)
    }

    @Test
    fun aNewReportIsAnnounced() {
        val (updated, alerts) = AlertRules.check(baselined(q2), status(q3), 200L)
        assertEquals(listOf(Alert.NewReport("KO", "COCA COLA CO", q3)), alerts)
        assertEquals(q3, updated.report)
    }

    @Test
    fun aFirstEverReportIsAnnounced() {
        val (_, alerts) = AlertRules.check(baselined(null), status(q3), 200L)
        assertEquals(listOf(Alert.NewReport("KO", "COCA COLA CO", q3)), alerts)
    }

    @Test
    fun anOlderReportShowingUpLateIsNotAnnounced() {
        // e.g. a delayed amendment of an earlier quarter indexed after the newer one
        val (_, alerts) = AlertRules.check(baselined(q3), status(q2), 200L)
        assertEquals(emptyList<Alert>(), alerts)
    }

    @Test
    fun newSeriousWarningsAreAnnouncedOldestFirst_otherEventsAreNot() {
        val (updated, alerts) = AlertRules.check(baselined(q3), status(q3, auditor, late, letter), 200L)
        assertEquals(
            listOf(Alert.Warning("KO", "COCA COLA CO", late), Alert.Warning("KO", "COCA COLA CO", auditor)),
            alerts,
        )
        assertTrue(letter.key in updated.seenEvents)                    // SEC letters are recorded but not announced
    }

    @Test
    fun aWarningIsAnnouncedOnlyOnce() {
        val (afterFirst, first) = AlertRules.check(baselined(q3), status(q3, late), 200L)
        val (_, second) = AlertRules.check(afterFirst, status(q3, late), 300L)
        assertEquals(1, first.size)
        assertEquals(emptyList<Alert>(), second)
    }

    @Test
    fun aMissingReportInTheResponseKeepsTheKnownOne() {
        val (updated, alerts) = AlertRules.check(baselined(q3), status(null), 200L)
        assertEquals(q3, updated.report)
        assertEquals(emptyList<Alert>(), alerts)
    }

    @Test
    fun onlyTheAgreedTypesCountAsSerious() {
        assertEquals(
            setOf("non_reliance", "auditor_change", "late_filing", "amendment", "bankruptcy", "delisting_notice", "cyber_incident", "impairment"),
            AlertRules.SERIOUS,
        )
    }

    @Test
    fun theNewSeriousEightKEventsAreAnnouncedButAcquisitionsAreNot() {
        val notice = FilingEvent("2026-08-01", "delisting_notice", "8-K", "https://sec/301")
        val writeDown = FilingEvent("2026-08-02", "impairment", "8-K", "https://sec/206")
        val hack = FilingEvent("2026-08-03", "cyber_incident", "8-K", "https://sec/105")
        val bankrupt = FilingEvent("2026-08-04", "bankruptcy", "8-K", "https://sec/103")
        val deal = FilingEvent("2026-08-05", "acquisition", "8-K", "https://sec/201")
        val (updated, alerts) = AlertRules.check(baselined(q3), status(q3, deal, bankrupt, hack, writeDown, notice), 200L)
        assertEquals(
            listOf(notice, writeDown, hack, bankrupt).map { Alert.Warning("KO", "COCA COLA CO", it) }, // oldest first
            alerts,
        )
        assertTrue(deal.key in updated.seenEvents) // recorded, so it's never announced later either
    }
}
