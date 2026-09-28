package com.dipaknehe.stockvalue

import android.Manifest
import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.action.ViewActions.click
import androidx.test.espresso.assertion.ViewAssertions.doesNotExist
import androidx.test.espresso.assertion.ViewAssertions.matches
import androidx.test.espresso.matcher.ViewMatchers.isDisplayed
import androidx.test.espresso.matcher.ViewMatchers.withContentDescription
import androidx.test.espresso.matcher.ViewMatchers.withId
import androidx.test.espresso.matcher.ViewMatchers.withText
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.rule.GrantPermissionRule
import androidx.work.ListenableWorker
import androidx.work.testing.TestListenableWorkerBuilder
import androidx.work.workDataOf
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.hamcrest.Matchers.containsString
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.RuleChain
import org.junit.rules.TestRule
import org.junit.runner.RunWith
import java.util.concurrent.TimeUnit

/** Watchlist, background filing checks and alerts, against a local server standing in for the web app. */
@RunWith(AndroidJUnit4::class)
class WatchTest {

    @get:Rule
    val notifications: TestRule =
        if (Build.VERSION.SDK_INT >= 33) GrantPermissionRule.grant(Manifest.permission.POST_NOTIFICATIONS) else RuleChain.emptyRuleChain()

    private val context: Context = ApplicationProvider.getApplicationContext()
    private val store = WatchStore(context)
    private val server = MockWebServer()

    @Volatile private var apiJson = apiResponse(report = Q2)
    private val paths = java.util.concurrent.CopyOnWriteArrayList<String>() // every path the app requested

    @Before
    fun setUp() {
        store.clear()
        manager().cancelAll()
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.path.orEmpty()
                paths += path
                return when {
                    path.startsWith("/api/financials?ticker=KO") -> json(apiJson)
                    path.startsWith("/api/financials") -> MockResponse().setResponseCode(404).setBody("{}")
                    path.startsWith("/?t=") -> page("<h1 id=\"title\">Results</h1>")
                    else -> page("<h1 id=\"title\">Home</h1>")
                }
            }
        }
        server.start()
    }

    @After
    fun tearDown() {
        store.clear()
        manager().cancelAll()
        Site.debugOverride = null
        server.shutdown()
    }

    private fun manager() = context.getSystemService(NotificationManager::class.java)
    private fun page(html: String) = MockResponse().setHeader("Content-Type", "text/html; charset=utf-8").setBody(html)
    private fun json(body: String) = MockResponse().setHeader("Content-Type", "application/json").setBody(body)
    private fun site() = server.url("/").toString()

    private fun launch(url: String): ActivityScenario<MainActivity> = ActivityScenario.launch(
        Intent(context, MainActivity::class.java)
            .putExtra(MainActivity.EXTRA_SITE_URL, site())
            .putExtra(MainActivity.EXTRA_OPEN_URL, url),
    )

    private fun eventually(timeoutMs: Long = 15_000, check: () -> Unit) {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (true) {
            try {
                check(); return
            } catch (e: Throwable) {
                if (System.currentTimeMillis() > deadline) throw e
                Thread.sleep(200)
            }
        }
    }

    private fun runCheck(): ListenableWorker.Result =
        TestListenableWorkerBuilder<FilingCheckWorker>(context)
            .setInputData(workDataOf(FilingCheckWorker.KEY_SITE_URL to site()))
            .build()
            .doWork()

    private fun postedTexts(): List<String> =
        manager().activeNotifications.map { it.notification.extras.getCharSequence(Notification.EXTRA_TEXT).toString() }

    @Test
    fun theWatchButtonShowsOnlyOnAResultsPage() {
        launch(site()).use {
            onView(withId(R.id.action_watchlist)).check(matches(isDisplayed()))
            onView(withId(R.id.action_watch)).check(doesNotExist())
        }
        launch(SiteUrls.results(site(), "KO")).use {
            eventually { onView(withId(R.id.action_watch)).check(matches(isDisplayed())) }
        }
    }

    @Test
    fun aTickerSecDoesNotKnowCannotBeWatched() {
        // After a wrong ticker the page address keeps it (?t=ZZZZQ), so the star shows; watching must refuse it.
        launch(SiteUrls.results(site(), "ZZZZQ")).use {
            eventually { onView(withId(R.id.action_watch)).check(matches(isDisplayed())) }
            onView(withId(R.id.action_watch)).perform(click())
            eventually { assertTrue(paths.any { it.startsWith("/api/financials?ticker=ZZZZQ") }) }
            Thread.sleep(1_000) // give a wrongly accepted add time to happen
            assertEquals(emptyList<Watched>(), store.all())
        }
    }

    @Test
    fun watchingRecordsTheStartingPointAndShowsInTheWatchlist() {
        launch(SiteUrls.results(site(), "KO")).use {
            eventually { onView(withId(R.id.action_watch)).check(matches(isDisplayed())) }
            onView(withId(R.id.action_watch)).perform(click())
            eventually { assertTrue(store.contains("KO")) } // added once the app has checked SEC knows KO

            // The immediate check records today's filings without alerting about them.
            eventually { assertTrue(store.all().single().baselined) }
            assertEquals(Q2, store.all().single().report)
            assertEquals(emptyList<String>(), postedTexts())

            // The toolbar was just re-laid out (☆ → ★); retry the tap until the Watchlist screen is open.
            eventually {
                try {
                    onView(withId(R.id.checkNow)).check(matches(isDisplayed()))
                } catch (e: Throwable) {
                    onView(withId(R.id.action_watchlist)).perform(click())
                    throw e
                }
            }
            eventually { onView(withText("COCA COLA CO (KO)")).check(matches(isDisplayed())) }
            onView(withText(containsString("Latest report: 10-Q filed 2026-04-28"))).check(matches(isDisplayed()))

            onView(withContentDescription("Stop watching KO")).perform(click())
            onView(withId(R.id.empty)).check(matches(isDisplayed()))
            assertEquals(emptyList<Watched>(), store.all())
        }
    }

    @Test
    fun aCheckAlertsOnceForANewReportAndASeriousWarning() {
        store.add("KO")
        store.update(Watched("KO", "COCA COLA CO", Q2, emptySet(), baselined = true, lastChecked = 1L))
        apiJson = apiResponse(report = Q3, events = listOf(LATE_FILING, SEC_LETTER))

        assertEquals(ListenableWorker.Result.success(), runCheck())
        val watched = store.all().single()
        assertEquals(Q3, watched.report)
        eventually {
            val texts = postedTexts()
            assertEquals(texts.toString(), 2, texts.size)                   // the SEC letter isn't announced
            assertTrue(texts.toString(), texts.any { "new 10-Q on 2026-07-29" in it })
            assertTrue(texts.toString(), texts.any { "late-filing notice (NT 10-K)" in it })
        }

        manager().cancelAll()
        assertEquals(ListenableWorker.Result.success(), runCheck())         // same filings again: nothing new
        Thread.sleep(500)
        assertEquals(emptyList<String>(), postedTexts())
    }

    @Test
    fun anUnknownTickerDoesNotStopTheOthersAndIsDropped() {
        store.add("ZZZZQ")
        store.add("KO")
        assertEquals(ListenableWorker.Result.success(), runCheck())
        assertTrue(store.all().first { it.ticker == "KO" }.baselined)
        assertEquals(listOf("KO"), store.all().map { it.ticker }) // SEC doesn't know ZZZZQ: it's removed
    }

    @Test
    fun aNotificationOpensTheCompanyOnItsHistoryTab() {
        launch(SiteUrls.results(site(), "KO", "history")).use {
            val first = server.takeRequest(10, TimeUnit.SECONDS)!!
            assertEquals("/?t=KO", first.path)                              // the fragment (#history) stays in the browser
            eventually { onView(withId(R.id.action_watch)).check(matches(isDisplayed())) }
        }
    }

    private companion object {
        val Q2 = Report("10-Q", "2026-04-28", "0000021344-26-000010", "https://www.sec.gov/q2.htm")
        val Q3 = Report("10-Q", "2026-07-29", "0000021344-26-000020", "https://www.sec.gov/q3.htm")
        val LATE_FILING = FilingEvent("2026-08-15", "late_filing", "NT 10-K", "https://www.sec.gov/nt.htm")
        val SEC_LETTER = FilingEvent("2026-08-01", "sec_letter", "UPLOAD", "https://www.sec.gov/letter.pdf")

        fun apiResponse(report: Report?, events: List<FilingEvent> = emptyList()): String {
            val ev = events.joinToString(",") {
                """{"date":"${it.date}","type":"${it.type}","form":"${it.form}","description":"x","url":"${it.url}"}"""
            }
            val rep = report?.let {
                """{"form":"${it.form}","date":"${it.date}","accession":"${it.accession}","url":"${it.url}"}"""
            } ?: "null"
            return """{"ticker":"KO","name":"COCA COLA CO","secHistory":{"since":"2016-01-01","events":[$ev],"counts":{}},"latestReport":$rep}"""
        }
    }
}
