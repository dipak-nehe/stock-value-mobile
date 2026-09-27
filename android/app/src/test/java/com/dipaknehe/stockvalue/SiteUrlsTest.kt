package com.dipaknehe.stockvalue

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SiteUrlsTest {
    private val site = "https://stock-value-analysis.vercel.app/"

    @Test
    fun resultsPagesGiveTheirTicker() {
        assertEquals("KO", SiteUrls.tickerOf("https://stock-value-analysis.vercel.app/?t=KO", site))
        assertEquals("KO", SiteUrls.tickerOf("https://stock-value-analysis.vercel.app/?t=ko&lang=es#flags", site))
        assertEquals("SMCI", SiteUrls.tickerOf("https://stock-value-analysis.vercel.app/?lang=es&t=SMCI&p=30", site))
        assertEquals("BRK.B", SiteUrls.tickerOf("https://stock-value-analysis.vercel.app/index.html?t=BRK.B", site))
    }

    @Test
    fun otherPagesHaveNoTicker() {
        assertNull(SiteUrls.tickerOf("https://stock-value-analysis.vercel.app/", site))                    // start page
        assertNull(SiteUrls.tickerOf("https://stock-value-analysis.vercel.app/?lang=es", site))
        assertNull(SiteUrls.tickerOf("https://stock-value-analysis.vercel.app/compare.html?a=KO&b=PEP", site))
        assertNull(SiteUrls.tickerOf("https://www.sec.gov/?t=KO", site))                                   // other site
        assertNull(SiteUrls.tickerOf("https://stock-value-analysis.vercel.app/?t=", site))
        assertNull(SiteUrls.tickerOf("https://stock-value-analysis.vercel.app/?t=%3Cscript%3E", site))     // not a ticker
        assertNull(SiteUrls.tickerOf(null, site))
    }

    @Test
    fun resultsAddressesAreBuiltForATickerAndTab() {
        assertEquals("https://stock-value-analysis.vercel.app/?t=KO", SiteUrls.results(site, "KO"))
        assertEquals("https://stock-value-analysis.vercel.app/?t=SMCI#history", SiteUrls.results(site, "SMCI", "history"))
        assertEquals("http://localhost:8080/?t=BRK.B", SiteUrls.results("http://localhost:8080", "BRK.B"))
    }
}
