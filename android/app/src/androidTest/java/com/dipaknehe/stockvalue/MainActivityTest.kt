package com.dipaknehe.stockvalue

import android.app.Activity
import android.app.Instrumentation.ActivityResult
import android.content.Intent
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.Espresso.pressBack
import androidx.test.espresso.action.ViewActions.click
import androidx.test.espresso.assertion.ViewAssertions.matches
import androidx.test.espresso.intent.Intents
import androidx.test.espresso.intent.Intents.intended
import androidx.test.espresso.intent.Intents.intending
import androidx.test.espresso.intent.matcher.IntentMatchers.hasAction
import androidx.test.espresso.intent.matcher.IntentMatchers.hasData
import androidx.test.espresso.matcher.ViewMatchers.isDisplayed
import androidx.test.espresso.matcher.ViewMatchers.withId
import androidx.test.espresso.web.sugar.Web.onWebView
import androidx.test.espresso.web.webdriver.DriverAtoms.findElement
import androidx.test.espresso.web.webdriver.DriverAtoms.getText
import androidx.test.espresso.web.webdriver.DriverAtoms.webClick
import androidx.test.espresso.web.webdriver.Locator
import androidx.test.ext.junit.runners.AndroidJUnit4
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import okhttp3.mockwebserver.SocketPolicy
import org.hamcrest.Matchers.allOf
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/** Drives the real screen against a local server standing in for the web app. */
@RunWith(AndroidJUnit4::class)
class MainActivityTest {

    private val server = MockWebServer()
    @Volatile private var offline = false

    private val home = """
        <html><body>
        <h1 id="title">Home</h1>
        <a id="internal" href="/next">Next page</a>
        <a id="external" href="https://www.sec.gov/">SEC</a>
        <a id="newTab" href="https://github.com/" target="_blank">GitHub</a>
        <p id="ua"></p>
        <script>document.getElementById('ua').textContent = navigator.userAgent</script>
        </body></html>
    """.trimIndent()

    @Before
    fun setUp() {
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse = when {
                offline -> MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AT_START)
                request.path == "/next" -> page("<h1 id=\"title\">Next</h1>")
                request.path == "/" -> page(home)
                else -> MockResponse().setResponseCode(404)
            }
        }
        server.start()
        Intents.init()
        // Stub every outgoing VIEW intent so no real browser opens during the tests.
        intending(hasAction(Intent.ACTION_VIEW)).respondWith(ActivityResult(Activity.RESULT_OK, null))
    }

    @After
    fun tearDown() {
        Intents.release()
        server.shutdown()
    }

    private fun page(html: String) = MockResponse().setHeader("Content-Type", "text/html; charset=utf-8").setBody(html)

    private fun launch(): ActivityScenario<MainActivity> = ActivityScenario.launch(
        Intent(ApplicationProvider.getApplicationContext(), MainActivity::class.java)
            .putExtra(MainActivity.EXTRA_SITE_URL, server.url("/").toString()),
    )

    /** Page loads are asynchronous; retry a WebView check for up to 10 s. */
    private fun eventually(check: () -> Unit) {
        val deadline = System.currentTimeMillis() + 10_000
        while (true) {
            try {
                check(); return
            } catch (e: Throwable) {
                if (System.currentTimeMillis() > deadline) throw e
                Thread.sleep(200)
            }
        }
    }

    private fun titleIs(text: String) = eventually {
        onWebView().withElement(findElement(Locator.ID, "title")).check(
            androidx.test.espresso.web.assertion.WebViewAssertions.webMatches(getText(), org.hamcrest.Matchers.equalTo(text)),
        )
    }

    @Test
    fun loadsTheSiteAndIdentifiesTheApp() {
        launch().use {
            titleIs("Home")
            val ua = server.takeRequest().getHeader("User-Agent").orEmpty()
            assertTrue(ua, ua.contains("${MainActivity.USER_AGENT_TAG}/"))
        }
    }

    @Test
    fun linksWithinTheSiteStayInTheAppAndBackReturns() {
        launch().use {
            titleIs("Home")
            onWebView().withElement(findElement(Locator.ID, "internal")).perform(webClick())
            titleIs("Next")
            pressBack()
            titleIs("Home")
        }
    }

    @Test
    fun otherSitesOpenInTheBrowser() {
        launch().use {
            titleIs("Home")
            onWebView().withElement(findElement(Locator.ID, "external")).perform(webClick())
            eventually { intended(allOf(hasAction(Intent.ACTION_VIEW), hasData("https://www.sec.gov/"))) }
            titleIs("Home")   // the app stays on its page
        }
    }

    @Test
    fun newTabLinksOpenInTheBrowser() {
        launch().use {
            titleIs("Home")
            onWebView().withElement(findElement(Locator.ID, "newTab")).perform(webClick())
            eventually { intended(allOf(hasAction(Intent.ACTION_VIEW), hasData("https://github.com/"))) }
        }
    }

    @Test
    fun offlineShowsARetryScreenThatRecovers() {
        offline = true
        launch().use {
            eventually { onView(withId(R.id.error)).check(matches(isDisplayed())) }
            offline = false
            onView(withId(R.id.retry)).perform(click())
            titleIs("Home")
            onView(withId(R.id.web)).check(matches(isDisplayed()))
        }
    }
}
