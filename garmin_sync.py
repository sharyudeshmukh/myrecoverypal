"""
Garmin -> Lovable dashboard sync.

Pulls your sleep, stress, Body Battery, HRV, training readiness, daily stats
and recent workouts from Garmin Connect (via the unofficial `garminconnect`
library, v0.3+) and POSTs them to your Lovable Edge Function `ingest-garmin`.

Usage:
  First time, on your own computer:  python garmin_sync.py --login
  Normal run (last 2 days):          python garmin_sync.py
  Backfill history:                  python garmin_sync.py --days 90

Environment variables:
  INGEST_URL    https://<project-ref>.supabase.co/functions/v1/ingest-garmin
  INGEST_TOKEN  the shared secret you stored in Lovable as INGEST_TOKEN
  GARMIN_EMAIL / GARMIN_PASSWORD   only needed for --login
"""

import argparse
import datetime as dt
import json
import os
import sys
import time
from getpass import getpass

import requests
from garminconnect import Garmin

TOKENSTORE = os.path.expanduser(os.environ.get("GARMIN_TOKENSTORE", "~/.garminconnect"))


def get(d, *path, default=None):
    """Safely walk nested dicts/lists; returns default if anything is missing."""
    for key in path:
        if d is None:
            return default
        if isinstance(key, int):
            d = d[key] if isinstance(d, list) and len(d) > key else None
        else:
            d = d.get(key) if isinstance(d, dict) else None
    return default if d is None else d


def safe(fn, *args):
    try:
        return fn(*args)
    except Exception as e:  # one failing endpoint shouldn't kill the run
        print(f"  ! {fn.__name__}{args}: {e}", file=sys.stderr)
        return None


def login_interactive():
    email = os.environ.get("GARMIN_EMAIL") or input("Garmin email: ")
    password = os.environ.get("GARMIN_PASSWORD") or getpass("Garmin password: ")
    garmin = Garmin(email, password, prompt_mfa=lambda: input("MFA code: "))
    garmin.login(TOKENSTORE)
    print(f"Logged in. Tokens saved in {TOKENSTORE}/garmin_tokens.json")
    print("Copy that file's contents into the GitHub secret GARMIN_TOKENS.")


def collect_day(g, day):
    ds = day.isoformat()
    stats = safe(g.get_stats, ds) or {}
    sleep = safe(g.get_sleep_data, ds) or {}
    hrv = safe(g.get_hrv_data, ds) or {}
    readiness = safe(g.get_training_readiness, ds)
    stress = safe(g.get_stress_data, ds) or {}

    if isinstance(readiness, list):
        readiness = readiness[0] if readiness else {}
    readiness = readiness or {}

    sleep_dto = get(sleep, "dailySleepDTO", default={})
    return {
        "date": ds,
        # sleep
        "sleep_score": get(sleep_dto, "sleepScores", "overall", "value"),
        "sleep_seconds": get(sleep_dto, "sleepTimeSeconds"),
        "deep_sleep_seconds": get(sleep_dto, "deepSleepSeconds"),
        "rem_sleep_seconds": get(sleep_dto, "remSleepSeconds"),
        "light_sleep_seconds": get(sleep_dto, "lightSleepSeconds"),
        "awake_seconds": get(sleep_dto, "awakeSleepSeconds"),
        # recovery
        "resting_hr": get(stats, "restingHeartRate"),
        "hrv_last_night_avg": get(hrv, "hrvSummary", "lastNightAvg"),
        "hrv_weekly_avg": get(hrv, "hrvSummary", "weeklyAvg"),
        "hrv_status": get(hrv, "hrvSummary", "status"),
        "training_readiness": get(readiness, "score"),
        "training_readiness_level": get(readiness, "level"),
        # stress + body battery
        "stress_avg": get(stats, "averageStressLevel"),
        "stress_max": get(stats, "maxStressLevel"),
        "body_battery_high": get(stats, "bodyBatteryHighestValue"),
        "body_battery_low": get(stats, "bodyBatteryLowestValue"),
        "body_battery_charged": get(stats, "bodyBatteryChargedValue"),
        "body_battery_drained": get(stats, "bodyBatteryDrainedValue"),
        "body_battery_wake": get(stats, "bodyBatteryAtWakeTime"),
        # activity
        "steps": get(stats, "totalSteps"),
        "active_kcal": get(stats, "activeKilocalories"),
        "intensity_minutes": (get(stats, "moderateIntensityMinutes", default=0)
                              + 2 * get(stats, "vigorousIntensityMinutes", default=0)),
        # full payloads so you can build new insights later without re-syncing
        "raw": {"stats": stats, "sleep": sleep, "hrv": hrv,
                "readiness": readiness, "stress_summary": {
                    k: v for k, v in stress.items() if not isinstance(v, list)}},
    }


def collect_activities(g, start, end):
    acts = safe(g.get_activities_by_date, start.isoformat(), end.isoformat()) or []
    out = []
    for a in acts:
        out.append({
            "activity_id": get(a, "activityId"),
            "name": get(a, "activityName"),
            "type": get(a, "activityType", "typeKey"),
            "start_time_local": get(a, "startTimeLocal"),
            "duration_seconds": get(a, "duration"),
            "distance_meters": get(a, "distance"),
            "avg_hr": get(a, "averageHR"),
            "max_hr": get(a, "maxHR"),
            "calories": get(a, "calories"),
            "aerobic_te": get(a, "aerobicTrainingEffect"),
            "anaerobic_te": get(a, "anaerobicTrainingEffect"),
            "training_load": get(a, "activityTrainingLoad"),
            "avg_pace_or_speed": get(a, "averageSpeed"),
            "elevation_gain": get(a, "elevationGain"),
            "raw": a,
        })
    return out


def push(payload):
    url, token = os.environ["INGEST_URL"], os.environ["INGEST_TOKEN"]
    r = requests.post(url, json=payload, timeout=60,
                      headers={"x-ingest-token": token})
    r.raise_for_status()
    print(f"  -> pushed: {r.text[:200]}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--login", action="store_true", help="one-time interactive login")
    p.add_argument("--days", type=int, default=2, help="how many days back to sync")
    args = p.parse_args()

    if args.login:
        login_interactive()
        return

    g = Garmin()
    g.login(TOKENSTORE)  # uses saved tokens, refreshes them as needed

    today = dt.date.today()
    start = today - dt.timedelta(days=args.days - 1)

    # push in chunks of 14 days so big backfills don't time out
    day = start
    while day <= today:
        chunk_end = min(day + dt.timedelta(days=13), today)
        print(f"Syncing {day} .. {chunk_end}")
        days = []
        d = day
        while d <= chunk_end:
            days.append(collect_day(g, d))
            d += dt.timedelta(days=1)
            time.sleep(0.5)  # be gentle with Garmin
        push({"days": days, "activities": collect_activities(g, day, chunk_end)})
        day = chunk_end + dt.timedelta(days=1)


if __name__ == "__main__":
    main()
