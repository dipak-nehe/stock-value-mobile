import { say, type Lang } from '../lang.js';

/** The results page's tabs, in order. */
export const TABS = ['overview', 'flags', 'history', 'insiders', 'value', 'durable', 'charts', 'data'] as const;
export type Tab = (typeof TABS)[number];

/**
 * The live web app's start and results page, inside the app's web view (Android WebView, iOS WKWebView). Use inside `inWebView(...)`.
 *
 * Locator order for web content (same rule as the web app's own Playwright tests): accessible name (`aria/`,
 * WebdriverIO's equivalent of getByRole/getByLabel) for controls, in the page's language → `data-testid` for
 * content the tests read → `#id` only where the name is incidental hard-coded text (arrows, counts) → no XPath.
 */
export class WebAnalysisPage {
    constructor(readonly lang: Lang = 'en') {}

    /** The site's single top-level heading. CSS: WebdriverIO has no role selector; h1 is the heading role. */
    get siteTitle() {
        return $('h1');
    }

    get searchBox() {
        return $(`aria/${say(this.lang, 'Look up a company by name or ticker', 'Busca una empresa por nombre o ticker')}`);
    }

    get analyzeButton() {
        return $(`aria/${say(this.lang, 'Analyze', 'Analizar')}`);
    }

    /** The page has loaded and its scripts have run (module scripts run before the page counts as complete). */
    async waitUntilReady(timeout = 60_000): Promise<void> {
        await browser.waitUntil(() => browser.execute(() => document.readyState === 'complete'), {
            timeout,
            timeoutMsg: 'the web page never finished loading',
        });
    }

    /** Types a ticker and presses Analyze, which the site enables only once there's a ticker in the box. */
    async search(ticker: string): Promise<void> {
        await this.searchBox.setValue(ticker);
        await this.analyzeButton.waitForEnabled({ timeout: 30_000 });
        await this.analyzeButton.click();
    }

    get companyName() {
        return $('[data-testid="company-name"]');
    }

    get glance() {
        return $('[data-testid="glance"]');
    }

    /** #id: a tab's name ends with its badge count ("Red flags 2"). */
    tab(name: Tab) {
        return $(`#tab-${name}`);
    }

    /** #id: the link text is hard-coded copy with an arrow. */
    get compareLink() {
        return $('#compareLink');
    }

    /** #id: a tab's panel (panel-<tab>); its accessible name repeats the tab's, badge count included. */
    panel(name: Tab) {
        return $(`#panel-${name}`);
    }

    /** The "Durable advantage" tab's "Meets N of 13 criteria" score. */
    get durableScore() {
        return $('[data-testid="durable-score"]');
    }

    get trendTiles() {
        return $('[data-testid="trend-tiles"]');
    }

    get flags() {
        return $('[data-testid="flags"]');
    }

    /** The Insiders tab's section (insider trades from SEC Form 4s; says "Loading…" until they arrive). */
    get insiders() {
        return $('[data-testid="insiders"]');
    }

    get historyTiles() {
        return $$('[data-testid="history-tiles"] [data-testid="tile"]');
    }

    get grahamScore() {
        return $('[data-testid="graham-score"]');
    }

    chart(id: 'cRevenue' | 'cEps' | 'cDps' | 'cPayout' | 'cBalance' | 'cDebt' | 'cCash' | 'cMargin') {
        return $(`[data-testid="chart-${id}"]`);
    }

    /** #id: the data table has no name of its own (its scrollable region is named by the Data tab). */
    get dataTable() {
        return $('#table');
    }

    /** The error shown for a ticker the site can't find (role="alert"). */
    get error() {
        return $('[data-testid="error"]');
    }

    /** True when the element is inside the visible part of the page, where a person would actually see it. */
    async isInViewport(element: ChainablePromiseElement): Promise<boolean> {
        return browser.execute((el: HTMLElement) => {
            const r = el.getBoundingClientRect();
            return r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight;
        }, (await element) as unknown as HTMLElement);
    }
}

export default new WebAnalysisPage();
