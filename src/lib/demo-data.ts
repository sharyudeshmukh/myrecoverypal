import { shiftDate, type Daily, type Workout } from './fitness-dashboard';
import type { Goals, StrengthSet, WeightEntry } from './goals';

export const DEMO_USER_ID = 'demo-user';
const SEED = 20261018;
const DAYS = 90;

// Deterministic PRNG so screenshots and the story look identical every visit.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Category = 'BENCH_PRESS' | 'ROW' | 'SHOULDER_PRESS' | 'PULL_UP' | 'CURL' | 'TRICEPS_EXTENSION' | 'SQUAT' | 'DEADLIFT' | 'LUNGE' | 'HIP_RAISE' | 'CALF_RAISE' | 'PLANK';
const CATEGORY_INFO: Record<Category, { name: string; muscle: string }> = {
  BENCH_PRESS: { name: 'Bench press', muscle: 'chest' },
  ROW: { name: 'Barbell row', muscle: 'back' },
  SHOULDER_PRESS: { name: 'Overhead press', muscle: 'shoulders' },
  PULL_UP: { name: 'Pull-up', muscle: 'back' },
  CURL: { name: 'Bicep curl', muscle: 'arms' },
  TRICEPS_EXTENSION: { name: 'Tricep pushdown', muscle: 'arms' },
  SQUAT: { name: 'Squat', muscle: 'quads' },
  DEADLIFT: { name: 'Deadlift', muscle: 'back' },
  LUNGE: { name: 'Lunge', muscle: 'quads' },
  HIP_RAISE: { name: 'Hip thrust', muscle: 'glutes' },
  CALF_RAISE: { name: 'Standing calf raise', muscle: 'calves' },
  PLANK: { name: 'Plank', muscle: 'core' },
};

type ExercisePlan = { category: Category; sets: number; reps: number | null; duration: number | null; weight: number | null };

export type DemoData = {
  daily: Daily[];
  activities: Workout[];
  goals: Goals;
  weightLog: WeightEntry[];
  strengthSets: StrengthSet[];
};

export function generateDemoData(today: string): DemoData {
  const rand = mulberry32(SEED);
  const r = (min: number, max: number) => min + rand() * (max - min);
  const ri = (min: number, max: number) => Math.round(r(min, max));
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const roundW = (w: number) => Math.round(w / 5) * 5;
  const prog = (start: number, end: number, i: number) => start + (end - start) * (i / (DAYS - 1));
  const dates = Array.from({ length: DAYS }, (_, i) => shiftDate(today, -(DAYS - 1 - i)));

  // ---- Daily wellness: watch worn every night, steady fitness improvement ----
  const daily: Daily[] = dates.map((date, i) => {
    const p = i / (DAYS - 1);
    const sleep = ri(22320, 29160); // 6.2–8.1 h
    const deep = Math.round((sleep * ri(18, 25)) / 100);
    const rem = Math.round((sleep * ri(18, 25)) / 100);
    const awake = Math.round((sleep * ri(2, 6)) / 100);
    const sleepScore = ri(62, 88);
    const hrv = Math.round(38 + 8 * p + r(-2.5, 2.5)); // ~38 → ~46 ms
    const restingHr = Math.round(64 - 6 * p + r(-1.5, 1.5)); // 64 → 58
    const stress = ri(15, 40);
    const isToday = i === DAYS - 1;
    const batteryHigh = isToday ? 78 : ri(55, 95);
    const batteryWake = isToday ? 78 : batteryHigh - ri(0, 8);
    const readiness = clamp(Math.round(40 + (sleepScore - 62) * 1.2 + (hrv - 38) * 1.1 + r(-8, 8)), 35, 95);
    const maxHeartRate = ri(150, 185);
    return {
      date,
      sleep_score: sleepScore,
      sleep_seconds: sleep,
      deep_sleep_seconds: deep,
      rem_sleep_seconds: rem,
      light_sleep_seconds: sleep - deep - rem - awake,
      awake_seconds: awake,
      resting_hr: restingHr,
      hrv_last_night_avg: hrv,
      hrv_weekly_avg: Math.round(38 + 8 * p + r(-1, 1)),
      training_readiness: readiness,
      stress_avg: stress,
      stress_max: stress + ri(20, 45),
      body_battery_high: batteryHigh,
      body_battery_low: ri(5, 25),
      body_battery_charged: batteryHigh - ri(5, 20),
      body_battery_drained: ri(30, 70),
      body_battery_wake: batteryWake,
      steps: ri(6000, 14000),
      active_kcal: ri(280, 900),
      intensity_minutes: ri(0, 70),
      hrv_status: hrv >= 44 ? 'BALANCED' : hrv >= 40 ? 'UNBALANCED' : 'LOW',
      training_readiness_level: readiness >= 80 ? 'OPTIMAL' : readiness >= 60 ? 'GOOD' : 'MODERATE',
      raw: {
        stats: {
          totalKilocalories: 0, // filled below
          activeKilocalories: 0,
          bmrKilocalories: 1750,
          minHeartRate: Math.max(40, restingHr - ri(4, 10)),
          maxHeartRate,
          bodyBatteryMostRecentValue: batteryWake,
          restingHeartRate: restingHr,
        },
      },
    };
  });
  for (const day of daily) {
    const active = day.active_kcal ?? 0;
    const stats = (day.raw as { stats: Record<string, number> }).stats;
    stats['activeKilocalories'] = active;
    stats['totalKilocalories'] = active + 1750;
  }

  // ---- Workouts: 3 strength + 3 cardio a week, progressive overload ----
  // Weekly cycle rotated so the story is always the same: lower body was
  // trained yesterday, upper body is fresh today, and 4 days back is a rest
  // day (so the recovery rule doesn't trigger).
  const CYCLE: (null | 'upper' | 'lower' | 'full' | 'run')[] = ['upper', 'run', 'run', 'lower', 'run', 'full', null];
  const cycleOffset = DAYS - 5; // index of yesterday within the cycle alignment
  const totalRuns = dates.filter((_, i) => CYCLE[(((i - cycleOffset) % 7) + 7) % 7] === 'run').length;
  const activities: Workout[] = [];
  const strengthSets: StrengthSet[] = [];
  let runCount = 0;

  const zoneSeconds = (duration: number, pcts: number[]) => pcts.map((pct) => Math.round((duration * pct) / 100));

  for (let i = 0; i < DAYS; i++) {
    let kind = CYCLE[(((i - cycleOffset) % 7) + 7) % 7];
    if (i === DAYS - 1) kind = null; // today's session not done yet
    if (kind === null) continue;
    const date = dates[i] as string;
    const activityId = 90000000 + i;
    const start = `${date} ${String(6 + (i % 3)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00`;

    if (kind === 'run') {
      runCount++;
      const p = i / (DAYS - 1);
      const distanceKm = 3.0 + 2.4 * p + r(-0.15, 0.15); // walk-run → continuous 5K+
      const paceMin = 7.5 - 1.45 * p + r(-0.1, 0.1); // ~7:30 → ~6:00 /km
      const durationSec = Math.round(distanceKm * paceMin * 60);
      const isOutdoor = i % 2 === 0;
      const speed = 1000 / (paceMin * 60);
      const fullSplits = Math.floor(distanceKm);
      const remainder = distanceKm - fullSplits;
      const splitSummaries = Array.from({ length: fullSplits + (remainder > 0.3 ? 1 : 0) }, (_, k) => ({
        distance: k === fullSplits ? Math.round(remainder * 1000) : 1000,
        averageSpeed: speed * (1 + r(-0.02, 0.02)),
        averageHR: ri(135, 155),
      }));
      const [z1, z2, z3, z4, z5] = zoneSeconds(durationSec, [10, 45, 30, 12, 3]);
      activities.push({
        activity_id: activityId,
        name: isOutdoor ? 'Outdoor Run' : 'Treadmill Run',
        type: isOutdoor ? 'running' : 'treadmill_running',
        start_time_local: start,
        duration_seconds: durationSec,
        distance_meters: Math.round(distanceKm * 1000),
        avg_hr: ri(132, 152),
        max_hr: ri(160, 180),
        calories: Math.round((durationSec / 60) * 8.5),
        aerobic_te: Math.round(r(2.8, 4) * 10) / 10,
        anaerobic_te: Math.round(r(0.3, 1.5) * 10) / 10,
        training_load: ri(60, 110),
        avg_pace_or_speed: Math.round(speed * 100) / 100,
        elevation_gain: isOutdoor ? ri(4, 25) : 0,
        raw: {
          movingDuration: Math.round(durationSec * 0.99),
          hrTimeInZone_1: z1,
          hrTimeInZone_2: z2,
          hrTimeInZone_3: z3,
          hrTimeInZone_4: z4,
          hrTimeInZone_5: z5,
          splitSummaries,
        },
      });
      continue;
    }

    // Strength day
    const scale = kind === 'full' ? 0.9 : 1;
    let plan: ExercisePlan[];
    let name: string;
    if (kind === 'upper') {
      name = 'Upper body strength';
      plan = [
        { category: 'BENCH_PRESS', sets: 3, reps: 8, duration: null, weight: roundW(prog(75, 100, i) * scale) },
        { category: 'ROW', sets: 3, reps: 8, duration: null, weight: roundW(prog(80, 105, i) * scale) },
        { category: 'SHOULDER_PRESS', sets: 3, reps: 10, duration: null, weight: roundW(prog(45, 60, i) * scale) },
        { category: 'PULL_UP', sets: 3, reps: Math.round(prog(5, 9, i)), duration: null, weight: null },
        { category: 'CURL', sets: 3, reps: 12, duration: null, weight: roundW(prog(25, 35, i) * scale) },
        { category: 'TRICEPS_EXTENSION', sets: 3, reps: 12, duration: null, weight: roundW(prog(30, 40, i) * scale) },
      ];
    } else if (kind === 'lower') {
      name = 'Lower body strength';
      plan = [
        { category: 'SQUAT', sets: 3, reps: 6, duration: null, weight: roundW(prog(95, 135, i) * scale) },
        { category: 'DEADLIFT', sets: 3, reps: 6, duration: null, weight: roundW(prog(115, 155, i) * scale) },
        { category: 'LUNGE', sets: 3, reps: 10, duration: null, weight: roundW(prog(40, 55, i) * scale) },
        { category: 'HIP_RAISE', sets: 3, reps: 10, duration: null, weight: roundW(prog(95, 135, i) * scale) },
        { category: 'CALF_RAISE', sets: 3, reps: 15, duration: null, weight: roundW(prog(60, 80, i) * scale) },
        { category: 'PLANK', sets: 3, reps: null, duration: Math.round(prog(45, 90, i)), weight: null },
      ];
    } else {
      name = 'Full body strength';
      plan = [
        { category: 'SQUAT', sets: 3, reps: 8, duration: null, weight: roundW(prog(95, 135, i) * scale) },
        { category: 'BENCH_PRESS', sets: 3, reps: 8, duration: null, weight: roundW(prog(75, 100, i) * scale) },
        { category: 'ROW', sets: 3, reps: 10, duration: null, weight: roundW(prog(80, 105, i) * scale) },
        { category: 'PLANK', sets: 3, reps: null, duration: Math.round(prog(45, 90, i)), weight: null },
        { category: 'CALF_RAISE', sets: 3, reps: 15, duration: null, weight: roundW(prog(60, 80, i) * scale) },
        { category: 'CURL', sets: 3, reps: 12, duration: null, weight: roundW(prog(25, 35, i) * scale) },
      ];
    }
    const duration = ri(2700, 3300); // 45–55 min
    const totalSets = plan.reduce((s, e) => s + e.sets, 0);
    const totalReps = plan.reduce((s, e) => s + (e.reps ?? 0) * e.sets, 0);
    const [z1, z2, z3, z4, z5] = zoneSeconds(duration, [20, 40, 25, 10, 5]);
    activities.push({
      activity_id: activityId,
      name,
      type: 'strength_training',
      start_time_local: start,
      duration_seconds: duration,
      distance_meters: null,
      avg_hr: ri(105, 125),
      max_hr: ri(140, 165),
      calories: ri(220, 380),
      aerobic_te: Math.round(r(1.5, 2.5) * 10) / 10,
      anaerobic_te: Math.round(r(2, 3.5) * 10) / 10,
      training_load: ri(50, 100),
      avg_pace_or_speed: null,
      elevation_gain: null,
      raw: {
        movingDuration: Math.round(duration * 0.75),
        activeSets: totalSets,
        totalReps,
        hrTimeInZone_1: z1,
        hrTimeInZone_2: z2,
        hrTimeInZone_3: z3,
        hrTimeInZone_4: z4,
        hrTimeInZone_5: z5,
        summarizedExerciseSets: plan.map((e) =>
          e.duration !== null
            ? { category: e.category, sets: e.sets, duration: e.duration }
            : { category: e.category, sets: e.sets, reps: e.reps },
        ),
      },
    });
    for (const e of plan) {
      for (let n = 1; n <= e.sets; n++) {
        strengthSets.push({
          id: `demo-set-${activityId}-${e.category}-${n}`,
          user_id: DEMO_USER_ID,
          activity_id: activityId,
          exercise: CATEGORY_INFO[e.category].name,
          muscle_group: CATEGORY_INFO[e.category].muscle,
          set_number: n,
          reps: e.reps,
          weight: e.weight,
          created_at: start,
        });
      }
    }
  }

  // ---- Weight: 182 lb → ~174 lb, ~0.7 lb/week with daily noise ----
  const weightLog: WeightEntry[] = dates.map((date, i) => ({
    id: `demo-weight-${i}`,
    user_id: DEMO_USER_ID,
    date,
    weight: Math.round((182 - 8 * (i / (DAYS - 1)) + r(-0.8, 0.8)) * 10) / 10,
    created_at: `${date}T07:00:00Z`,
  }));

  const goals: Goals = {
    user_id: DEMO_USER_ID,
    goal: 'Lose weight + build muscle',
    current_weight: weightLog[DAYS - 1]?.weight ?? 174,
    target_weight: 165,
    units: 'lb',
    age: 32,
    max_hr: null,
    steps_goal: 10000,
    strength_target: 3,
    cardio_minutes_target: 150,
    updated_at: `${today}T07:00:00Z`,
  };

  return { daily, activities, weightLog, goals, strengthSets };
}
