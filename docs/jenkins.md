# Jenkins pipeline

[`Jenkinsfile`](../Jenkinsfile) builds both apps and runs their tests on a Jenkins server, with the same steps as the GitHub Actions workflows (`.github/workflows/android.yml` and `ios.yml`). The GitHub workflows keep running as before; Jenkins is an extra way to run the same checks, for example on your own machines.

## What a build does

Android and iOS run **in parallel**, each on its own kind of machine (a Jenkins *agent*, picked by label).

| Stage | Runs | What it does | Results in Jenkins |
|---|---|---|---|
| Android: unit tests, lint, APK | every build | `./gradlew testDebugUnitTest lintDebug assembleDebug` | Test Result view, lint report, the APK |
| Android: start the emulator | with DEVICE_TESTS | `jenkins/android-emulator.sh start`: a headless Android 14 (API 34) emulator | |
| Android: emulator tests | with DEVICE_TESTS | Espresso tests (`connectedDebugAndroidTest`) | Test Result view, HTML report, device log on failure |
| Android: Appium end-to-end | with DEVICE_TESTS | WebdriverIO + Appium (UiAutomator2), after warming the app up | Allure report (screenshots and a video per test), logs |
| iOS: prepare | every build | XcodeGen generates the Xcode project; the newest iPhone simulator is picked | |
| iOS: build and unit tests | every build | `xcodebuild test` on the simulator | Test Result view (with xcbeautify), log, `.xcresult` |
| iOS: Appium end-to-end | with DEVICE_TESTS | WebdriverIO + Appium (XCUITest) on the simulator | Allure report, logs |

Afterwards the emulator is stopped and the simulators are shut down, even if a stage failed.

### Build with Parameters

| Parameter | Default | Meaning |
|---|---|---|
| ANDROID | ticked | Build and test the Android app |
| IOS | ticked | Build and test the iOS app |
| DEVICE_TESTS | not ticked | Also run the emulator and simulator tests (30–60 minutes) |
| E2E_SUITE | all | End-to-end suite: `mock` (a local copy of the site), `live` (the real site) or both |
| IOS_SPEC | empty | iOS end-to-end: run only this spec file, e.g. `./specs/mock/watch-alerts.e2e.ts` |

The first build of a new job runs with the defaults; the parameters appear after it.

## Agents

| Label | Machine | Needs |
|---|---|---|
| `android` | Linux or macOS | JDK 21 (`JAVA_HOME`), the Android SDK (`ANDROID_HOME`) with cmdline-tools, platform-tools and emulator, Node 22. Device tests: hardware acceleration (KVM on Linux; Apple silicon Macs use the arm64 image automatically) and about 10 GB free disk |
| `macos && xcode` | Mac | Xcode with an iOS simulator runtime, Homebrew (XcodeGen is installed if missing), Python 3, Node 22. Optional: `brew install xcbeautify` for test results in Jenkins' Test Result view |

One machine can carry both labels (`android macos xcode`) if it has everything. To add the labels: Manage Jenkins → Nodes → the node → Configure → Labels.

**This Mac** (8 GB RAM, about 3 GB free disk, no Xcode) can run the Android quick stage only: unit tests, lint and the APK. The emulator, the Appium suites and everything iOS need a bigger machine, which is why the GitHub workflows run them on GitHub's runners.

## Plugins

Pipeline, Git, JUnit and Timestamper (all in Jenkins' suggested plugins). Optional: **Allure** (installed here) plus an *Allure Commandline* tool under Manage Jenkins → Tools, to show the report inside Jenkins; without it the single-file report is still in each build's artifacts (`e2e/<platform>/allure-report/index.html`).

## Create the job

1. New Item → name it (e.g. `stock-value-mobile`) → **Pipeline** → OK.
2. Pipeline → Definition: **Pipeline script from SCM** → SCM: Git → Repository URL `https://github.com/dipak-nehe/stock-value-mobile.git` (public, so no credentials) → Branch `*/main` → Script Path `Jenkinsfile`.
3. Save → **Build Now** (or Build with Parameters after the first build).

## Check the Jenkinsfile's syntax

Jenkins can validate a Jenkinsfile without running it. Create an API token (your user → Security → API Token), keep it in an environment variable rather than typing it into a command, and run from the repository folder:

```bash
export JENKINS_USER=<your Jenkins user> JENKINS_TOKEN=<the API token>
curl -s -u "$JENKINS_USER:$JENKINS_TOKEN" -X POST -F "jenkinsfile=<Jenkinsfile" \
  http://localhost:8080/pipeline-model-converter/validate
```

It prints `Jenkinsfile successfully validated.` or the line of each error.
