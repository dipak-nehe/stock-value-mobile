import { say, type Lang } from '../screens/lang.js';

/** The live web app's compare page, inside the app's WKWebView. Use inside `inWebView(...)`. Same locator order as WebAnalysisPage. */
export class WebComparePage {
    constructor(readonly lang: Lang = 'en') {}

    /** The first slot's status line, e.g. "COCA COLA CO (KO)" once loaded. */
    get statusA() {
        return $('[data-testid="status-a"]');
    }

    /** #id: its accessible name ("Second stock") is shared with its search form, so the name alone is ambiguous. */
    get secondTicker() {
        return $('#tickerB');
    }

    get compareButton() {
        return $(`aria/${say(this.lang, 'Compare', 'Comparar')}`);
    }

    async compareWith(ticker: string): Promise<void> {
        await this.secondTicker.setValue(ticker);
        await this.compareButton.click();
    }

    get comparison() {
        return $('[data-testid="comparison"]');
    }

    get companyCardsArea() {
        return $('[data-testid="company-cards"]');
    }

    get companyCards() {
        return $$('[data-testid="company-card"]');
    }

    /** "Open full analysis →" on the nth company card (0 = first company). */
    async openFullAnalysis(card: number): Promise<void> {
        await this.companyCards[card].$(`aria/${say(this.lang, 'Open full analysis →', 'Ver el análisis completo →')}`).click();
    }

    /** #id: the table's region is named after a hard-coded heading ("Key figures"). */
    get figuresTable() {
        return $('#cmpTable');
    }

    chart(id: 'cmpRevenue' | 'cmpEps') {
        return $(`[data-testid="chart-${id}"]`);
    }
}

export default new WebComparePage();
