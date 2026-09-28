import { createServer, type Server } from 'node:http';

export interface Report { form: string; date: string; accession: string; url: string }
export interface FilingEvent { date: string; type: string; form: string; url: string }

const page = (body: string) =>
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>Mock web app</title></head><body style="font:18px sans-serif;padding:16px"><main>${body}</main></body></html>`;

/**
 * A tiny stand-in for the web app: a start page, a second page, a results page and the /api/financials endpoint
 * the app's background check reads. Tests change `report` and `events` to simulate new SEC filings.
 */
export class MockSite {
    report: Report | null = null;
    events: FilingEvent[] = [];
    readonly requests: string[] = [];
    private server?: Server;

    constructor(readonly port: number) {}

    /** The address as the app sees it: localhost is the test computer (Android reaches it through `adb reverse`; the iOS simulator shares the Mac's network). */
    get url(): string {
        return `http://localhost:${this.port}/`;
    }

    async start(): Promise<void> {
        this.server = createServer((req, res) => {
            const url = req.url ?? '/';
            this.requests.push(url);
            const send = (status: number, type: string, body: string) => {
                res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
                res.end(body);
            };
            if (url.startsWith('/api/financials?ticker=KO')) {
                return send(200, 'application/json', JSON.stringify({
                    ticker: 'KO',
                    name: 'COCA COLA CO',
                    secHistory: { since: '2016-01-01', events: this.events.map((e) => ({ ...e, description: 'x' })), counts: {} },
                    latestReport: this.report,
                }));
            }
            if (url.startsWith('/api/')) return send(404, 'application/json', '{"error":"Not found"}');
            if (url.startsWith('/next')) return send(200, 'text/html', page('<h1 id="title" data-testid="title">Next</h1>'));
            if (url.startsWith('/?t=')) return send(200, 'text/html', page('<h1 id="title" data-testid="title">KO results</h1>'));
            return send(200, 'text/html', page(
                '<h1 id="title" data-testid="title">Home</h1><p><a id="internal" href="/next" style="font-size:24px">Next page</a></p>',
            ));
        });
        await new Promise<void>((resolve) => this.server!.listen(this.port, '127.0.0.1', resolve));
    }

    async stop(): Promise<void> {
        await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
    }
}
