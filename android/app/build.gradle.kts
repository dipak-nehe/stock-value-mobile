plugins {
    alias(libs.plugins.android.application)
}

android {
    namespace = "com.dipaknehe.stockvalue"
    compileSdk = 37  // required by the current AndroidX libraries; targetSdk sets runtime behaviour

    defaultConfig {
        applicationId = "com.dipaknehe.stockvalue"
        minSdk = 26  // Android 8.0+: adaptive icons without legacy PNGs
        targetSdk = 37
        versionCode = 1
        versionName = "1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        // The web app this shell wraps. Tests point the debug build at a local server instead.
        buildConfigField("String", "SITE_URL", "\"https://stock-value-analysis.vercel.app/\"")
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
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
        warningsAsErrors = true
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
    implementation(libs.androidx.activity)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.webkit)
    implementation(libs.androidx.swiperefreshlayout)

    testImplementation(libs.junit)

    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.rules)
    androidTestImplementation(libs.espresso.core)
    androidTestImplementation(libs.espresso.web)
    androidTestImplementation(libs.espresso.intents)
    androidTestImplementation(libs.mockwebserver)
}
