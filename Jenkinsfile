// Jenkins pipeline for the Android and iOS apps: build them and run their tests.
//
// The same steps as .github/workflows/android.yml and ios.yml, for a Jenkins server. Android and iOS run in parallel,
// each on its own kind of machine (agent), chosen by label:
//   android        a Linux or macOS machine with JDK 21, the Android SDK (ANDROID_HOME) and Node 22. For the device
//                  tests it also needs the emulator and hardware acceleration (KVM on Linux).
//   macos && xcode a Mac with Xcode, Homebrew, Python 3 and Node 22.
// Setup, plugins and how to create the job: docs/jenkins.md.
//
// Every build runs the quick checks (unit tests, lint, app builds). The slower device tests (Espresso on an
// emulator, and the Appium end-to-end suites on an emulator and a simulator: 30-60 minutes) run only when
// DEVICE_TESTS is ticked in "Build with Parameters".
pipeline {
    // No machine for the pipeline as a whole: each platform picks its own agent below.
    agent none

    // The form shown by "Build with Parameters".
    parameters {
        booleanParam(name: 'ANDROID', defaultValue: true, description: 'Build and test the Android app')
        booleanParam(name: 'IOS', defaultValue: true, description: 'Build and test the iOS app (needs a Mac agent with Xcode)')
        booleanParam(name: 'DEVICE_TESTS', defaultValue: false,
                     description: 'Also run the emulator and simulator tests: Espresso and the Appium end-to-end suites (30-60 min)')
        choice(name: 'E2E_SUITE', choices: ['all', 'mock', 'live'],
               description: 'End-to-end suite: mock (a local copy of the site), live (the real site) or both')
        string(name: 'IOS_SPEC', defaultValue: '',
               description: 'iOS end-to-end: run only this spec file (e.g. ./specs/mock/watch-alerts.e2e.ts); empty = the suite above')
    }

    options {
        timestamps()                                    // a time on every log line
        timeout(time: 120, unit: 'MINUTES')             // stop a stuck build (a hung emulator, say)
        disableConcurrentBuilds()                       // one build at a time: the device tests share emulators
        buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '5'))  // keep the last 20 builds' logs
    }

    stages {
        stage('Apps') {
            // Android and iOS at the same time, on different machines.
            parallel {

                // ===================================== Android =====================================
                stage('Android') {
                    // beforeAgent: decide before asking for a machine, so an unticked platform never waits for one.
                    when { beforeAgent true; expression { params.ANDROID } }
                    agent { label 'android' }
                    environment {
                        GRADLE_OPTS = '-Dorg.gradle.daemon=false'   // no Gradle daemon left running between builds
                        APK = 'android/app/build/outputs/apk/debug/app-debug.apk'
                    }
                    stages {
                        // 1. JVM unit tests, Android lint and the debug APK (as in the GitHub "build" job).
                        stage('Android: unit tests, lint, APK') {
                            steps {
                                dir('android') {
                                    sh './gradlew testDebugUnitTest lintDebug assembleDebug'
                                }
                            }
                            post {
                                always {
                                    // Test results in Jenkins' own "Test Result" view, and the lint report.
                                    junit allowEmptyResults: true, testResults: 'android/app/build/test-results/testDebugUnitTest/*.xml'
                                    archiveArtifacts allowEmptyArchive: true, artifacts: 'android/app/build/reports/lint-results-debug.html'
                                }
                                success {
                                    // The APK, downloadable from the build page.
                                    archiveArtifacts artifacts: env.APK, fingerprint: true
                                }
                            }
                        }

                        // 2. Start a headless emulator (jenkins/android-emulator.sh) for the two device stages.
                        stage('Android: start the emulator') {
                            when { expression { params.DEVICE_TESTS } }
                            steps {
                                sh 'jenkins/android-emulator.sh start'
                            }
                        }

                        // 3. Espresso (instrumented) tests on the emulator.
                        stage('Android: emulator tests') {
                            when { expression { params.DEVICE_TESTS } }
                            steps {
                                dir('android') {
                                    // On failure keep the device log: app crashes and the app's own log lines.
                                    sh './gradlew connectedDebugAndroidTest || { adb logcat -d > app/build/reports/logcat.txt; exit 1; }'
                                }
                            }
                            post {
                                always {
                                    junit allowEmptyResults: true, testResults: 'android/app/build/outputs/androidTest-results/connected/**/*.xml'
                                    archiveArtifacts allowEmptyArchive: true,
                                                     artifacts: 'android/app/build/reports/androidTests/connected/**, android/app/build/reports/logcat.txt'
                                }
                            }
                        }

                        // 4. Appium end-to-end (WebdriverIO + UiAutomator2) on the same emulator.
                        stage('Android: Appium end-to-end') {
                            when { expression { params.DEVICE_TESTS } }
                            steps {
                                dir('e2e/android') {
                                    // Exact versions from package-lock.json, a type check, and the Appium driver list.
                                    sh 'npm ci && npm run typecheck && npm run appium:drivers'
                                }
                                // Warm-up: a freshly booted emulator is busy, so open the app once and let it settle.
                                sh '''
                                    adb install -r "$APK"
                                    adb shell am start -W -n com.dipaknehe.stockvalue/.MainActivity
                                    sleep 45
                                    adb shell am force-stop com.dipaknehe.stockvalue
                                '''
                                dir('e2e/android') {
                                    sh "npm run ${suiteScript()} || { mkdir -p logs; adb logcat -d > logs/logcat.txt; exit 1; }"
                                }
                            }
                            post {
                                always {
                                    allureReport('e2e/android')
                                }
                            }
                        }
                    }
                    post {
                        always {
                            // Never leave an emulator running on the agent.
                            sh 'jenkins/android-emulator.sh stop || true'
                        }
                    }
                }

                // ======================================= iOS =======================================
                stage('iOS') {
                    when { beforeAgent true; expression { params.IOS } }
                    agent { label 'macos && xcode' }
                    stages {
                        // 1. Generate the Xcode project from ios/project.yml (XcodeGen) and pick an iPhone simulator.
                        stage('iOS: prepare') {
                            steps {
                                sh '''
                                    xcodebuild -version
                                    command -v xcodegen >/dev/null || brew install xcodegen
                                    cd ios && xcodegen generate
                                '''
                                // The newest iPhone simulator on this Mac: udid, name and version into sim.env.
                                sh 'rm -f sim.env && GITHUB_OUTPUT="$WORKSPACE/sim.env" python3 .github/scripts/pick_simulator.py'
                            }
                        }

                        // 2. Build the app and run its unit tests on the simulator (as in the GitHub "test" job).
                        stage('iOS: build and unit tests') {
                            steps {
                                dir('ios') {
                                    sh '''
                                        set -o pipefail
                                        UDID=$(sed -n 's/^udid=//p' "$WORKSPACE/sim.env")
                                        rm -rf TestResults.xcresult
                                        xcodebuild test \
                                          -project StockValue.xcodeproj -scheme StockValue \
                                          -destination "id=$UDID" \
                                          -resultBundlePath TestResults.xcresult \
                                          CODE_SIGNING_ALLOWED=NO | tee xcodebuild.log | grep -E "error:|Test Case|Executed|\\*\\* (TEST|BUILD)" || true
                                        grep -q "\\*\\* TEST SUCCEEDED \\*\\*" xcodebuild.log
                                    '''
                                }
                            }
                            post {
                                always {
                                    // JUnit results for Jenkins' "Test Result" view, when xcbeautify is installed on the Mac.
                                    sh '''
                                        if command -v xcbeautify >/dev/null; then
                                          xcbeautify --quiet --report junit --report-path ios/junit < ios/xcodebuild.log >/dev/null || true
                                        fi
                                    '''
                                    junit allowEmptyResults: true, testResults: 'ios/junit/*.xml'
                                    archiveArtifacts allowEmptyArchive: true, artifacts: 'ios/xcodebuild.log, ios/TestResults.xcresult/**'
                                }
                            }
                        }

                        // 3. Appium end-to-end (WebdriverIO + XCUITest) on the simulator.
                        stage('iOS: Appium end-to-end') {
                            when { expression { params.DEVICE_TESTS } }
                            steps {
                                // Build the app where e2e/ios/support/capabilities.ts looks for it (ios/build).
                                dir('ios') {
                                    sh '''
                                        set -o pipefail
                                        UDID=$(sed -n 's/^udid=//p' "$WORKSPACE/sim.env")
                                        xcodebuild build \
                                          -project StockValue.xcodeproj -scheme StockValue \
                                          -destination "id=$UDID" -derivedDataPath build \
                                          CODE_SIGNING_ALLOWED=NO | tee xcodebuild-app.log | grep -E "error:|\\*\\* BUILD" || true
                                        test -d build/Build/Products/Debug-iphonesimulator/StockValue.app
                                    '''
                                }
                                dir('e2e/ios') {
                                    sh 'npm ci && npm run typecheck && npm run appium:drivers'
                                }
                                // Boot the simulator, then run one spec (IOS_SPEC) or the chosen suite.
                                sh '''
                                    UDID=$(sed -n 's/^udid=//p' sim.env)
                                    xcrun simctl boot "$UDID" 2>/dev/null || true
                                    xcrun simctl bootstatus "$UDID" -b
                                '''
                                dir('e2e/ios') {
                                    sh """
                                        export IOS_UDID=\$(sed -n 's/^udid=//p' "\$WORKSPACE/sim.env")
                                        export IOS_DEVICE_NAME="\$(sed -n 's/^name=//p' "\$WORKSPACE/sim.env")"
                                        export IOS_VERSION=\$(sed -n 's/^version=//p' "\$WORKSPACE/sim.env")
                                        if [ -n "\$IOS_SPEC" ]; then npx wdio run wdio.conf.ts --spec "\$IOS_SPEC"; else npm run ${suiteScript()}; fi
                                    """
                                }
                            }
                            post {
                                always {
                                    allureReport('e2e/ios')
                                    archiveArtifacts allowEmptyArchive: true, artifacts: 'ios/xcodebuild-app.log'
                                }
                            }
                        }
                    }
                    post {
                        always {
                            // Leave the Mac with no simulator running.
                            sh 'xcrun simctl shutdown all || true'
                        }
                    }
                }
            }
        }
    }
}

/** The e2e package's npm script for the E2E_SUITE parameter. */
String suiteScript() {
    return [all: 'test', mock: 'test:mock', live: 'test:live'][params.E2E_SUITE]
}

/** Build the single-file Allure report and keep it with the logs; also show it in Jenkins if the Allure plugin is set up. */
void allureReport(String dirPath) {
    dir(dirPath) {
        sh 'npm run report || true'
    }
    archiveArtifacts allowEmptyArchive: true, artifacts: "${dirPath}/allure-report/**, ${dirPath}/logs/**"
    try {
        // Needs the Allure Jenkins plugin and an "Allure Commandline" tool (Manage Jenkins → Tools).
        allure includeProperties: false, results: [[path: "${dirPath}/allure-results"]]
    } catch (Throwable err) {  // also the "No such DSL method" error when the plugin isn't installed
        echo "Allure plugin not available (${err.getMessage()}); the report is in the build's artifacts instead."
    }
}
