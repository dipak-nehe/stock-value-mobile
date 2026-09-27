import { say, type Lang } from '../screens/lang.js';

/**
 * The live web app's start and results page, inside the app's WKWebView. Use inside `inWebView(...)`.
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
        return $(`aria/${say(this.lang, 'Look up a company', 'Buscar una empresa')}`);
    }

    get analyzeButton() {
        return $(`aria/${say(this.lang, 'Analyze', 'Analizar')}`);
    }

    async search(ticker: string): Promise<void> {
        await this.searchBox.setValue(ticker);
        await this.analyzeButton.click();
    }

    get companyName() {
        return $('[data-testid="company-name"]');
    }

    get glance() {
        return $('[data-testid="glance"]');
    }

    /** #id: a tab's name ends with its badge count ("Red flags 2"). */
    tab(name: 'overview' | 'flags' | 'history' | 'value' | 'charts' | 'data') {
        return $(`#tab-${name}`);
    }

    /** #id: the link text is hard-coded copy with an arrow. */
    get compareLink() {
        return $('#compareLink');
    }
}

export default new WebAnalysisPage();
