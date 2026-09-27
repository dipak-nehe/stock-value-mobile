"""Count the Allure results of the end-to-end run and show them on the GitHub run's summary page.

A test re-run by specFileRetries has a result per attempt; only its last attempt counts.
Writes passed/failed/broken/skipped/total to $GITHUB_OUTPUT and $GITHUB_STEP_SUMMARY, and prints them.

Usage: python3 .github/scripts/allure_counts.py e2e/allure-results
"""
import glob
import json
import os
import sys


def main(folder):
    latest = {}
    for path in glob.glob(os.path.join(folder, "*-result.json")):
        with open(path) as fh:
            r = json.load(fh)
        key = r.get("historyId") or r.get("fullName") or r.get("name")
        if key not in latest or r.get("stop", 0) > latest[key].get("stop", 0):
            latest[key] = r
    counts = {s: 0 for s in ("passed", "failed", "broken", "skipped")}
    for r in latest.values():
        status = r.get("status", "broken")
        counts[status if status in counts else "broken"] += 1
    counts["total"] = sum(counts.values())
    print(", ".join(f"{k}={v}" for k, v in counts.items()))
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as fh:
            fh.writelines(f"{k}={v}\n" for k, v in counts.items())
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as fh:
            fh.write(f"### Appium end-to-end: {counts['passed']}/{counts['total']} passed\n\n"
                     f"failed {counts['failed']} · broken {counts['broken']} · skipped {counts['skipped']} "
                     "(a retried test counts once, by its last attempt). Report: the **appium-allure-report** artifact.\n")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "e2e/allure-results")
