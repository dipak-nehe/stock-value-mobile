package com.dipaknehe.stockvalue

import android.app.Activity
import android.app.Instrumentation.ActivityResult
import android.content.Intent
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.action.GeneralClickAction
import androidx.test.espresso.action.Press
import androidx.test.espresso.action.Tap
import androidx.test.espresso.action.ViewActions.click
import androidx.test.espresso.assertion.ViewAssertions.matches
import androidx.test.espresso.intent.Intents
import androidx.test.espresso.intent.Intents.intended
import androidx.test.espresso.intent.Intents.intending
import androidx.test.espresso.intent.matcher.IntentMatchers.hasAction
import androidx.test.espresso.intent.matcher.IntentMatchers.hasData
import androidx.test.espresso.matcher.ViewMatchers.isDisplayed
import androidx.test.espresso.matcher.ViewMatchers.withId
import androidx.test.espresso.web.model.Atoms.castOrDie
import androidx.test.espresso.web.model.Atoms.script
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
import org.hamcrest.Matchers.allOf
import org.hamcrest.Matchers.not
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.net.ServerSocket

/** Drives the real screen against a local server standing in for the web app. */
@RunWith(AndroidJUnit4::class)
class MainActivityTest {

    private val server = MockWebServer()

    private val home = """
        <html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>
        <h1 id="title">Home</h1>
        <a id="internal" href="/next">Next page</a>
        <a id="external" href="https://www.sec.gov/">SEC</a>
        <a id="newTab" href="https://github.com/" target="_blank">GitHub</a>
        <p id="ua"></p>
        <script>document.getElementById('ua').textContent = navigator.userAgent</script>
        </body></html>
    """.trimIndent()

    private val site = object : Dispatcher() {
        override fun dispatch(request: RecordedRequest): MockResponse = when (request.path) {
            "/next" -> page("<h1 id=\"title\">Next</h1>")
            "/" -> page(home)
            else -> MockResponse().setResponseCode(404)
        }
    }

    @Before
    fun setUp() {
        server.dispatcher = site
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

    private fun launch(url: String = server.url("/").toString()): ActivityScenario<MainActivity> = ActivityScenario.launch(
        Intent(ApplicationProvider.getApplicationContext(), MainActivity::class.java).putExtra(MainActivity.EXTRA_SITE_URL, url),
    )

    /**
     * A real finger tap on a page element (a user gesture), as a person would do. New-tab links need this:
     * a scripted click on them can be blocked like a pop-up.
     */
    private fun tapElement(id: String) {
        val xy = onWebView().perform(
            script(
                "var r = document.getElementById('$id').getBoundingClientRect();" +
                    "return (r.left + r.width / 2) * devicePixelRatio + ',' + (r.top + r.height / 2) * devicePixelRatio;",
                castOrDie(String::class.java),
            ),
        ).get().split(",").map { it.toFloat() }
        onView(withId(R.id.web)).perform(
            GeneralClickAction(Tap.SINGLE, { view ->
                val origin = IntArray(2).also { view.getLocationOnScreen(it) }
                floatArrayOf(origin[0] + xy[0], origin[1] + xy[1])
            }, Press.FINGER, 0, 0),
        )
    }

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
        launch().use { scenario ->
            titleIs("Home")
            // A real tap: Chrome's history intervention makes Back skip a page that was left without a user gesture,
            // so a scripted click wouldn't leave anything to go back to.
            tapElement("internal")
            titleIs("Next")
            // Back through the activity's back dispatcher: the path the system back gesture and button take.
            scenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }
            titleIs("Home")
            assertEquals(Lifecycle.State.RESUMED, scenario.state)   // went back a page instead of leaving the app
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
            tapElement("newTab")
            eventually { intended(allOf(hasAction(Intent.ACTION_VIEW), hasData("https://github.com/"))) }
        }
    }

    @Test
    fun offlineShowsARetryScreenThatRecovers() {
        val port = ServerSocket(0).use { it.localPort }   // a free port: nothing is listening, so the connection is refused
        val later = MockWebServer().apply { dispatcher = site }
        launch("http://localhost:$port/").use {
            eventually { onView(withId(R.id.error)).check(matches(isDisplayed())) }
            later.start(port)                              // the site "comes back"
            try {
                onView(withId(R.id.retry)).perform(click())
                titleIs("Home")
                onView(withId(R.id.web)).check(matches(isDisplayed()))
                onView(withId(R.id.error)).check(matches(not(isDisplayed())))
            } finally {
                later.shutdown()
            }
        }
    }
}
