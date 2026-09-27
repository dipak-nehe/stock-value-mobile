// The app's build settings (Gradle, written in Kotlin). Library versions live in gradle/libs.versions.toml.
plugins {
    alias(libs.plugins.android.application)
}

android {
    namespace = "com.dipaknehe.stockvalue"
    compileSdk = 37  // required by the current AndroidX libraries; targetSdk sets runtime behaviour

    defaultConfig {
        // The app's unique id on phones and in the Play Store. Changing it makes it a different app.
        applicationId = "com.dipaknehe.stockvalue"
        minSdk = 26  // Android 8.0+: adaptive icons without legacy PNGs
        targetSdk = 37
        // FOR EACH RELEASE: increase versionCode (a whole number, must always go up) and set versionName
        // (what people see, e.g. "1.1"). versionName also appears in the app's user agent.
        versionCode = 1
        versionName = "1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        // The web app this shell wraps. Tests point the debug build at a local server instead.
        // TO USE ANOTHER SITE: change the address here (keep the trailing slash and the \" quotes).
        buildConfigField("String", "SITE_URL", "\"https://stock-value-analysis.vercel.app/\"")
    }

    buildFeatures {
        buildConfig = true // generates BuildConfig (SITE_URL, DEBUG, VERSION_NAME) for the code to read
    }

    buildTypes {
        release {
            // Release builds are shrunk and optimised (rules in proguard-rules.pro).
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    lint {
        warningsAsErrors = true // any lint warning fails the build (and CI)
        abortOnError = true
        checkDependencies = true
        // Version bumps come through Dependabot pull requests, not lint failures.
        disable += setOf("NewerVersionAvailable", "GradleDependency", "AndroidGradlePluginVersion")
    }

    testOptions {
        animationsDisabled = true
    }
}

dependencies {
    // Libraries the app uses (versions: gradle/libs.versions.toml).
    implementation(libs.androidx.activity)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.webkit)
    implementation(libs.androidx.swiperefreshlayout)
    implementation(libs.androidx.work.runtime)

    // Libraries only the tests use.
    testImplementation(libs.junit)
    testImplementation(libs.org.json)  // the real org.json, so JSON code runs in JVM unit tests

    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.rules)
    androidTestImplementation(libs.espresso.core)
    androidTestImplementation(libs.espresso.web)
    androidTestImplementation(libs.espresso.intents)
    androidTestImplementation(libs.mockwebserver)
    androidTestImplementation(libs.androidx.work.testing)
}
