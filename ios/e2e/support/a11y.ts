import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { attachJson } from './report.js';

/** Apple's minimum recommended touch target (Human Interface Guidelines): 44 × 44 points. */
export const MIN_TOUCH_PT = 44;

interface UiNode {
    [key: string]: unknown;
}

export interface NativeIssue {
    rule: 'missing-label' | 'small-touch-target';
    element: string;
    detail: string;
}

const attr = (n: UiNode, name: string) => String(n[`@_${name}`] ?? '');

/** The kinds of element a person taps. (Not cells: SwiftUI puts plain text rows in cells too; row buttons are checked.) */
const TAPPABLE = new Set(['XCUIElementTypeButton', 'XCUIElementTypeLink', 'XCUIElementTypeSwitch']);

/**
 * Checks the app's native controls on the current screen: every visible, enabled control needs a label VoiceOver can
 * read, and a touch target of at least 44 × 44 pt. (The page source reports sizes in points.) The web page inside the
 * WKWebView is checked separately with axe-core.
 */
export async function checkNativeScreen(screenName: string): Promise<NativeIssue[]> {
    const xml = await driver.getPageSource();
    const tree = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' }).parse(xml) as UiNode;
    const issues: NativeIssue[] = [];

    const visit = (n: UiNode, type = '', inBar = false) => {
        if (type === 'XCUIElementTypeWebView') return; // web content: axe-core's job
        if (TAPPABLE.has(type) && attr(n, 'visible') === 'true' && attr(n, 'enabled') === 'true') {
            const name = `${type.replace('XCUIElementType', '')} ${attr(n, 'name') || attr(n, 'label') || '(unnamed)'}`;
            if (!attr(n, 'label').trim()) issues.push({ rule: 'missing-label', element: name, detail: 'no accessibility label' });
            const w = Number(attr(n, 'width'));
            const h = Number(attr(n, 'height'));
            // Navigation-bar buttons: iOS draws them as 36 pt capsules but makes the whole bar height tappable
            // around them, so only their width is ours to check.
            if (w < MIN_TOUCH_PT - 0.5 || (!inBar && h < MIN_TOUCH_PT - 0.5)) {
                issues.push({ rule: 'small-touch-target', element: name, detail: `${w}×${h}pt` });
            }
        }
        // fast-xml-parser keys child nodes by their tag, which is the element type.
        for (const [key, value] of Object.entries(n)) {
            if (key.startsWith('@_') || key === '#text') continue;
            for (const child of (Array.isArray(value) ? value : [value]).filter((v) => typeof v === 'object' && v !== null)) {
                visit(child as UiNode, key, inBar || type === 'XCUIElementTypeNavigationBar');
            }
        }
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

/** Runs axe-core (WCAG 2.0/2.1 A and AA) on the page in the current WEBVIEW context. */
export async function checkWebPage(pageName: string): Promise<string[]> {
    // The iOS web context starts with an async-script timeout of almost nothing; axe needs a few seconds.
    await browser.setTimeout({ script: 60_000 });
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
