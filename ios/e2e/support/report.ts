import allureReporter from '@wdio/allure-reporter';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Attaches a screenshot of the whole simulator screen to the Allure report under `name`. */
export async function screenshot(name: string): Promise<void> {
    try {
        await driver.switchContext('NATIVE_APP').catch(() => undefined); // the native screenshot includes the toolbar
        const png = await driver.takeScreenshot();
        allureReporter.addAttachment(name, Buffer.from(png, 'base64'), 'image/png');
    } catch {
        // a missing screenshot must never fail or hide a test result
    }
}

/** Attaches JSON (e.g. accessibility findings) to the Allure report. */
export function attachJson(name: string, value: unknown): void {
    allureReporter.addAttachment(name, JSON.stringify(value, null, 2), 'application/json');
}

/**
 * A video of each test, recorded with Xcode's own `simctl io … recordVideo` (H.264; no ffmpeg needed) and attached
 * to the test in the Allure report. Set E2E_VIDEO=0 to turn it off.
 */
export class VideoRecorder {
    private process?: ChildProcess;
    private file = '';

    constructor(private readonly folder: string) {}

    get enabled(): boolean {
        return process.env.E2E_VIDEO !== '0';
    }

    /** Starts recording; resolves once simctl reports the recording has begun (so the test's start is on video). */
    async start(udid: string, testName: string): Promise<void> {
        if (!this.enabled || !udid) return;
        mkdirSync(this.folder, { recursive: true });
        this.file = join(this.folder, `${Date.now()}-${testName.replace(/[^\w-]+/g, '_').slice(0, 60)}.mp4`);
        const recorder = spawn('xcrun', ['simctl', 'io', udid, 'recordVideo', '--codec=h264', '--force', this.file], {
            stdio: ['ignore', 'ignore', 'pipe'],
        });
        this.process = recorder;
        await new Promise<void>((resolve) => {
            const done = () => resolve();
            recorder.stderr?.on('data', (d: Buffer) => /Recording started/i.test(d.toString()) && done());
            recorder.on('exit', done);
            setTimeout(done, 5_000);
        });
    }

    /** Stops recording (SIGINT lets simctl finish the file) and attaches the video. */
    async stopAndAttach(name: string): Promise<void> {
        const recorder = this.process;
        this.process = undefined;
        if (!recorder) return;
        if (recorder.exitCode === null) {
            await new Promise<void>((resolve) => {
                recorder.on('exit', () => resolve());
                recorder.kill('SIGINT');
                setTimeout(resolve, 10_000);
            });
        }
        try {
            if (statSync(this.file).size > 0) allureReporter.addAttachment(name, readFileSync(this.file), 'video/mp4');
        } catch {
            // no video (the recorder failed to start): never fail the test for it
        } finally {
            rmSync(this.file, { force: true });
        }
    }
}
