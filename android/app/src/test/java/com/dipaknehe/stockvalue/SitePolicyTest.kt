package com.dipaknehe.stockvalue

import com.dipaknehe.stockvalue.SitePolicy.Target.APP
import com.dipaknehe.stockvalue.SitePolicy.Target.BLOCK
import com.dipaknehe.stockvalue.SitePolicy.Target.BROWSER
import org.junit.Assert.assertEquals
import org.junit.Test

class SitePolicyTest {
    private val policy = SitePolicy("https://stock-value-analysis.vercel.app/")

    private fun assertTarget(expected: SitePolicy.Target, url: String) = assertEquals(url, expected, policy.targetFor(url))

    @Test
    fun pagesOfTheWebAppStayInTheApp() {
        assertTarget(APP, "https://stock-value-analysis.vercel.app/")
        assertTarget(APP, "https://stock-value-analysis.vercel.app/?t=KO&lang=es#flags")
        assertTarget(APP, "https://stock-value-analysis.vercel.app/compare.html?a=KO&b=PEP&pa=68")
        assertTarget(APP, "https://Stock-Value-Analysis.Vercel.app/")          // host names ignore case
        assertTarget(APP, "https://stock-value-analysis.vercel.app:443/")      // explicit default port
    }

    @Test
    fun otherSitesOpenInTheBrowser() {
        assertTarget(BROWSER, "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=21344")
        assertTarget(BROWSER, "https://www.google.com/finance/quote/KO:NYSE")
        assertTarget(BROWSER, "https://github.com/dipak-nehe/stock-trend-analyzer")
        assertTarget(BROWSER, "mailto:someone@example.com")
    }

    @Test
    fun lookalikeAddressesAreNotTreatedAsTheApp() {
        assertTarget(BROWSER, "https://stock-value-analysis.vercel.app.example.com/")
        assertTarget(BROWSER, "https://evil-stock-value-analysis.vercel.app/")
        assertTarget(BROWSER, "https://other.vercel.app/?next=stock-value-analysis.vercel.app")
        assertTarget(BROWSER, "http://stock-value-analysis.vercel.app/")         // plain HTTP never loads in the app
        assertTarget(BROWSER, "https://stock-value-analysis.vercel.app:8443/")   // different port
    }

    @Test
    fun unsafeOrUnknownSchemesAreBlocked() {
        assertTarget(BLOCK, "javascript:alert(1)")
        assertTarget(BLOCK, "intent://scan/#Intent;scheme=zxing;end")
        assertTarget(BLOCK, "file:///sdcard/secret.txt")
        assertTarget(BLOCK, "content://contacts/people/1")
        assertTarget(BLOCK, "not a url")
        assertTarget(BLOCK, "/relative/path")
    }
}
