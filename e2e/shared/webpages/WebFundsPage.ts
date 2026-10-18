import { say, type Lang } from '../lang.js';

/** The live web app's Funds page (mutual funds & ETFs), inside the app's web view. Use inside `inWebView(...)`. */
export class WebFundsPage {
    constructor(readonly lang: Lang = 'en') {}

    get tickerBox() {
        return $(`aria/${say(this.lang, 'Fund or ETF ticker', 'Ticker del fondo o ETF')}`);
    }

    get addButton() {
        return $(`aria/${say(this.lang, 'Add', 'Añadir')}`);
    }

    async add(ticker: string): Promise<void> {
        await this.tickerBox.setValue(ticker);
        await this.addButton.click();
    }

    /** The example ticker chips under the box ("Try: VOO VTI …"), drawn by the page's script. */
    get examples() {
        return $$('[data-testid="fund-examples"] button');
    }

    get result() {
        return $('[data-testid="fund-result"]');
    }

    get columns() {
        return $$('[data-testid="fund-col"]');
    }

    /** One fund's cell in a measure's row (expenseRatio, cost20, ret10…), 0 = the first fund. */
    async cell(key: string, index: number) {
        return (await $(`[data-testid="fund-row"][data-key="${key}"]`).$$('td'))[index];
    }

    get topCards() {
        return $$('[data-testid="fund-top-card"]');
    }

    get overlapPairs() {
        return $$('[data-testid="fund-overlap-pair"]');
    }
}

export default new WebFundsPage();
