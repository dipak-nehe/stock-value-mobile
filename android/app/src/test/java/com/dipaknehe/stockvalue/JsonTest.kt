package com.dipaknehe.stockvalue

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class JsonTest {
    // Trimmed from a real /api/financials?ticker=KO&v=5 response.
    private val api = """
        {"ticker": "KO", "name": "COCA COLA CO", "cik": 21344, "years": [2024, 2025],
         "series": {"revenue": [1, 2]},
         "secHistory": {"since": "2016-01-01", "events": [
            {"date": "2022-10-17", "type": "sec_letter", "form": "UPLOAD", "description": "SEC staff letter", "url": "https://www.sec.gov/a.pdf"},
            {"date": "2019-03-01", "type": "late_filing", "form": "NT 10-K", "description": "Notice of late filing", "url": "https://www.sec.gov/b.htm"}
         ], "counts": {}},
         "latestReport": {"form": "10-Q", "date": "2026-07-29", "accession": "0001628280-26-050503",
                          "url": "https://www.sec.gov/Archives/edgar/data/21344/000162828026050503/ko-20260703.htm"}}
    """.trimIndent()

    @Test
    fun apiResponsesAreRead() {
        val s = StatusApi.parse(api)
        assertEquals("KO", s.ticker)
        assertEquals("COCA COLA CO", s.name)
        assertEquals(Report("10-Q", "2026-07-29", "0001628280-26-050503",
            "https://www.sec.gov/Archives/edgar/data/21344/000162828026050503/ko-20260703.htm"), s.report)
        assertEquals(listOf("sec_letter", "late_filing"), s.events.map { it.type })
        assertEquals("2019-03-01|late_filing|NT 10-K|https://www.sec.gov/b.htm", s.events[1].key)
    }

    @Test
    fun responsesWithoutHistoryOrReportAreRead() {
        val s = StatusApi.parse("""{"ticker": "NEWCO", "name": "New Co", "secHistory": null, "latestReport": null}""")
        assertNull(s.report)
        assertEquals(emptyList<FilingEvent>(), s.events)
    }

    @Test
    fun theWatchlistSurvivesSavingAndLoading() {
        val list = listOf(
            Watched("KO", "COCA COLA CO", Report("10-Q", "2026-07-29", "0001-26-1", "https://sec/q"),
                setOf("a|late_filing|NT 10-K|u", "b|sec_letter|UPLOAD|v"), baselined = true, lastChecked = 1_760_000_000_000),
            Watched("PEP"),                                                         // added, not yet checked
        )
        assertEquals(list, WatchCodec.decode(WatchCodec.encode(list)))
        assertEquals(emptyList<Watched>(), WatchCodec.decode(null))
        assertEquals(emptyList<Watched>(), WatchCodec.decode(""))
    }

    @Test
    fun theApiVersionMatchesTheWebApp() {
        // public/js/page.js API_VERSION; a mismatch would split the CDN cache and could miss new fields
        assertEquals(6, StatusApi.API_VERSION)
    }
}
