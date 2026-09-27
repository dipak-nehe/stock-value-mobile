/**
 * The local mock copy of the web app (support/mockSite.ts), inside the app's WebView.
 * Use inside `inWebView(...)`: these selectors only work in the WEBVIEW context.
 */
class MockPage {
    /** The page's heading: "Home", "Next" or "KO results". */
    get title() {
        return $('[data-testid="title"]');
    }

    /** The start page's link to /next, by its accessible name. */
    get nextPageLink() {
        return $('aria/Next page');
    }
}

export default new MockPage();
