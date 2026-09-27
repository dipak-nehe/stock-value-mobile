import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { APP_ID } from './capabilities.js';
import { adb } from './app.js';
import { attachJson } from './report.js';

/** Android's minimum recommended touch target (Material / accessibility guidelines). */
export const MIN_TOUCH_DP = 48;

interface UiNode {
    [key: string]: unknown;
}

export interface NativeIssue {
    rule: 'missing-label' | 'small-touch-target';
    element: string;
    detail: string;
}

const attr = (n: UiNode, name: string) => String(n[`@_${name}`] ?? '');
const children = (n: UiNode): UiNode[] =>
    Object.entries(n)
        .filter(([k]) => !k.startsWith('@_') && k !== '#text')
        .flatMap(([, v]) => (Array.isArray(v) ? v : [v]))
        .filter((v): v is UiNode => typeof v === 'object' && v !== null);

/** Text a screen reader would announce for a control: its own label, or the text inside it. */
function spokenLabel(n: UiNode): string {
    const own = (attr(n, 'content-desc') || attr(n, 'text')).trim();
    return own || children(n).map(spokenLabel).filter(Boolean).join(' ');
}

function density(): number {
    const out = adb('shell', 'wm', 'density'); // "Physical density: 420" (+ "Override density: …")
    const override = /Override density: (\d+)/.exec(out)?.[1];
    return Number(override ?? /Physical density: (\d+)/.exec(out)?.[1] ?? 160);
}

/**
 * Checks the app's native controls on the current screen: every tappable control needs a label a screen reader can
 * announce, and a touch target of at least 48dp. The web page inside the WebView is checked separately with axe-core.
 */
export async function checkNativeScreen(screenName: string): Promise<NativeIssue[]> {
    const xml = await driver.getPageSource();
    const tree = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' }).parse(xml) as UiNode;
    const scale = 160 / density();
    const issues: NativeIssue[] = [];

    const visit = (n: UiNode) => {
        if (attr(n, 'class') === 'android.webkit.WebView') return; // web content: axe-core's job
        const ours = attr(n, 'package') === APP_ID;
        if (ours && attr(n, 'clickable') === 'true' && attr(n, 'enabled') === 'true' && attr(n, 'displayed') !== 'false') {
            const name = `${attr(n, 'class')} ${attr(n, 'resource-id') || spokenLabel(n) || '(unnamed)'}`;
            if (!spokenLabel(n)) issues.push({ rule: 'missing-label', element: name, detail: 'no text or content description' });
            const m = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(attr(n, 'bounds'));
            if (m) {
                const w = (Number(m[3]) - Number(m[1])) * scale;
                const h = (Number(m[4]) - Number(m[2])) * scale;
                if (w < MIN_TOUCH_DP - 0.5 || h < MIN_TOUCH_DP - 0.5) {
                    issues.push({ rule: 'small-touch-target', element: name, detail: `${w.toFixed(0)}×${h.toFixed(0)}dp` });
                }
            }
        }
        children(n).forEach(visit);
    };
    visit(tree);
    attachJson(`native accessibility: ${screenName}`, issues);
    return issues;
}

const require = createRequire(import.meta.url);
const AXE_SOURCE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

export interface AxeViolation {
    id: string;
    impact: string | null;
    help: string;
    nodes: { target: string[] }[];
}

/** Runs axe-core (WCAG 2.0/2.1 A and AA) on the page in the current WebView context. */
export async function checkWebPage(pageName: string): Promise<string[]> {
    await browser.execute(AXE_SOURCE);
    const violations = (await browser.executeAsync((done: (v: unknown) => void) => {
        // @ts-expect-error axe is injected into the page above
        window.axe
            .run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })
            .then((r: { violations: unknown }) => done(r.violations))
            .catch((e: Error) => done([{ id: 'axe-error', impact: 'critical', help: String(e), nodes: [] }]));
    })) as AxeViolation[];
    attachJson(`axe: ${pageName}`, violations);
    return violations.map((v) => `[${v.impact}] ${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(', ')}`);
}
