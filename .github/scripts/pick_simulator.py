"""Pick the newest available iPhone simulator on this Mac.

Writes udid, name and version to $GITHUB_OUTPUT (when set) and prints them.
Usage: python3 .github/scripts/pick_simulator.py
"""
import json
import os
import subprocess


def main():
    devices = json.loads(subprocess.check_output(["xcrun", "simctl", "list", "devices", "available", "--json"]))["devices"]
    # Runtime keys look like com.apple.CoreSimulator.SimRuntime.iOS-26-4: sort by the version numbers at the end.
    runtimes = sorted(
        (k for k in devices if "iOS" in k),
        key=lambda k: [int(x) for x in k.rsplit("iOS-", 1)[-1].split("-")],
        reverse=True,
    )
    for runtime in runtimes:
        phones = [d for d in devices[runtime] if d["name"].startswith("iPhone")]
        if phones:
            picked = {
                "udid": phones[0]["udid"],
                "name": phones[0]["name"],
                "version": ".".join(runtime.rsplit("iOS-", 1)[-1].split("-")),
            }
            break
    else:
        raise SystemExit("no iPhone simulator available")
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a") as fh:
            fh.writelines(f"{k}={v}\n" for k, v in picked.items())
    print(picked)


if __name__ == "__main__":
    main()
