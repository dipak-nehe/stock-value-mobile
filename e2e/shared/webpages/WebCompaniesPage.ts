import { say, type Lang } from '../lang.js';

/** The live web app's All companies page, inside the app's web view. Use inside `inWebView(...)`. */
export class WebCompaniesPage {
    constructor(readonly lang: Lang = 'en') {}

    get search() {
        return $(`aria/${say(this.lang, 'Search by name or ticker', 'Busca por nombre o ticker')}`);
    }

    /** "Showing 100 of 10,443 companies" / "5 companies", written by the page's script once the list has loaded. */
    get count() {
        return $('[data-testid="co-count"]');
    }

    get rows() {
        return $$('[data-testid="co-row"]');
    }
}

export default new WebCompaniesPage();
