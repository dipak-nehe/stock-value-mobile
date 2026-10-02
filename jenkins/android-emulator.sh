#!/bin/sh
# Start or stop a headless Android emulator for the Jenkins device tests (the GitHub workflow uses the
# ReactiveCircus/android-emulator-runner action for the same job).
#
#   jenkins/android-emulator.sh start   install the system image if needed, create the AVD, boot it, wait until ready
#   jenkins/android-emulator.sh stop    shut the emulator down
#
# Needs ANDROID_HOME (or ANDROID_SDK_ROOT) with cmdline-tools, platform-tools and emulator installed.
set -eu

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
[ -n "$SDK" ] || { echo "ANDROID_HOME is not set on this agent" >&2; exit 1; }
export PATH="$SDK/platform-tools:$SDK/emulator:$SDK/cmdline-tools/latest/bin:$PATH"

API=34                                   # the same Android version as the GitHub workflow
AVD=jenkins-api$API
# An image that matches the agent's processor: x86_64 on Intel/AMD, arm64 on Apple silicon or ARM Linux.
case "$(uname -m)" in
  arm64|aarch64) ABI=arm64-v8a ;;
  *) ABI=x86_64 ;;
esac
IMAGE="system-images;android-$API;google_apis;$ABI"

case "${1:-}" in
  start)
    # Install the system image and create the virtual device the first time only.
    if ! avdmanager list avd -c | grep -qx "$AVD"; then
      yes | sdkmanager --install "$IMAGE" >/dev/null
      echo no | avdmanager create avd -n "$AVD" -k "$IMAGE" -d pixel_6 --force
    fi
    # Headless, fresh data each time, no audio or boot animation; logs go to emulator.log in the workspace.
    nohup emulator -avd "$AVD" -no-window -no-audio -no-boot-anim -no-snapshot -wipe-data \
      -gpu swiftshader_indirect -partition-size 4096 > emulator.log 2>&1 &
    adb wait-for-device
    # Wait up to 5 minutes for Android to finish booting.
    i=0
    until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
      i=$((i + 1)); [ "$i" -le 60 ] || { echo "the emulator didn't boot in 5 minutes" >&2; tail -50 emulator.log >&2; exit 1; }
      sleep 5
    done
    # Like disable-animations and the error-dialog setting in the GitHub workflow: no animations to wait for, and no
    # system "isn't responding" dialogs taking focus from the app under test. Then let the device settle.
    adb shell settings put global window_animation_scale 0
    adb shell settings put global transition_animation_scale 0
    adb shell settings put global animator_duration_scale 0
    adb shell settings put global hide_error_dialogs 1
    sleep 45
    echo "emulator $AVD ($ABI) is ready"
    ;;
  stop)
    adb emu kill 2>/dev/null || true
    ;;
  *)
    echo "usage: $0 start|stop" >&2
    exit 2
    ;;
esac
