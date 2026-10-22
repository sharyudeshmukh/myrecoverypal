import { describe, expect, it } from 'vitest';
import { computeGarminRecovery, decayRate, remainingFatigue, sessionMuscleLoads, todayRecoveryBattery } from '@/lib/garmin-recovery';
import { pacificTimestamp, type Daily, type Workout } from '@/lib/fitness-dashboard';
const activity = (overrides: Partial<Workout> = {}): Workout => ({ activity_id: 1, name: 'Workout', type: 'strength_training', start_time_local: '2026-10-18T10:00:00', duration_seconds: 2700, avg_hr: 100, raw: null, ...overrides } as Workout);
const now = pacificTimestamp('2026-10-18T12:00:00');
describe('automatic Garmin recovery', () => {
  it('maps named categories with 100% primary and 50% secondary load', () => {
    const loads = sessionMuscleLoads(activity({ raw: { summarizedExerciseSets: [{ category: 'BENCH_PRESS', sets: 10, reps: 30 }] } }));
    expect(loads.find(l => l.muscle === 'chest')?.load).toBe(550);
    expect(loads.find(l => l.muscle === 'arms')?.load).toBe(275);
    expect(loads.some(l => l.muscle === 'quads')).toBe(false);
  });
  it('uses duration when reps are missing', () => {
    const load = sessionMuscleLoads(activity({ raw: { summarizedExerciseSets: [{ category: 'PLANK', sets: 2, duration: 30 }] } }));
    expect(load.find(l => l.muscle === 'core')?.load).toBe(55);
  });
  it('spreads unknown strength evenly over all nine groups, scaled by duration and HR', () => {
    const loads = sessionMuscleLoads(activity({ raw: { summarizedExerciseSets: [{ category: 'UNKNOWN' }] } }));
    expect(loads).toHaveLength(9);
    expect(loads.every(l => Math.abs(l.load - 120 * 45 / 35) < .001 && l.evidence === 'estimated')).toBe(true);
    expect(sessionMuscleLoads(activity({ duration_seconds: 5400, avg_hr: 120 }))[0]?.load).toBeCloseTo(120 * 90 / 35 * 1.1);
  });
  it('adds running fatigue to legs and increases load for zones 3–5', () => {
    const loads = sessionMuscleLoads(activity({ type: 'running', duration_seconds: 1800, raw: { hrTimeInZone_3: 600, hrTimeInZone_4: 300, hrTimeInZone_5: 0 } }));
    expect(loads.map(l => l.muscle).sort()).toEqual(['calves', 'glutes', 'hamstrings', 'quads']);
    expect(loads.every(l => l.load === 45)).toBe(true);
  });
  it('indoor cardio gives smaller leg and full-body load', () => {
    const loads = sessionMuscleLoads(activity({ type: 'indoor_cardio', duration_seconds: 1800 }));
    expect(loads).toHaveLength(9);
    expect(loads.find(l => l.muscle === 'quads')?.load).toBe(15);
    expect(loads.find(l => l.muscle === 'chest')?.load).toBe(4.5);
  });
  it('calibrates all worked groups near 52% at 24h and 81% at 48h', () => {
    expect(100 - remainingFatigue(120, 24, 'quads', null)).toBeCloseTo(52);
    expect(100 - remainingFatigue(120, 48, 'arms', null)).toBeCloseTo(80.8);
  });
  it('slows decay 25% below battery 40 and accelerates at 70', () => {
    expect(decayRate(39)).toBe(0.75);
    expect(decayRate(40)).toBe(1);
    expect(decayRate(69)).toBe(1);
    expect(decayRate(70)).toBe(1.1);
    expect(remainingFatigue(100, 48, 'chest', 39)).toBeGreaterThan(remainingFatigue(100, 48, 'chest', 40));
  });
  it('uses only today’s battery, including zero', () => {
    const day: Daily = { date: '2026-10-18', body_battery_high: 80, raw: { stats: { bodyBatteryMostRecentValue: 0 } }, active_kcal: null, awake_seconds: null, body_battery_charged: null, body_battery_drained: null, body_battery_low: null, body_battery_wake: null, deep_sleep_seconds: null, hrv_last_night_avg: null, hrv_status: null, hrv_weekly_avg: null, intensity_minutes: null, light_sleep_seconds: null, rem_sleep_seconds: null, resting_hr: null, sleep_score: null, sleep_seconds: null, steps: null, stress_avg: null, stress_max: null, training_readiness: null, training_readiness_level: null };
    const daily = [day];
    expect(todayRecoveryBattery(daily, '2026-10-18')).toBe(0);
    expect(todayRecoveryBattery(daily, '2026-10-19')).toBeNull();
  });
  it('excludes workouts outside seven days and future workouts', () => {
    const result = computeGarminRecovery([activity({ start_time_local: '2026-10-11T11:59:59' }), activity({ activity_id: 2, start_time_local: '2026-10-19T10:00:00' })], [], now);
    expect(result.hasData).toBe(false);
    expect(result.cards.every(c => c.causes.length === 0)).toBe(true);
  });
  it('links causal workouts and selects the freshest muscles without manual logs', () => {
    const result = computeGarminRecovery([activity({ type: 'running' })], [], now);
    expect(result.cards.find(c => c.muscle === 'quads')?.causes[0]?.activityId).toBe(1);
    expect(result.freshest).toEqual(['chest', 'back', 'shoulders']);
    expect(result.cards.find(c => c.muscle === 'quads')?.status).toBe('Recovering');
  });
});
describe('v3 regional workload and freshness', () => {
  const upper = activity({ name: 'Upper body', duration_seconds: 32 * 60, raw: { summarizedExerciseSets: [{ category: 'ROW', sets: 1, reps: 7 }] } });
  it('loads all four upper groups below 70% one day after a 32-minute upper session', () => {
    const result = computeGarminRecovery([upper], [], pacificTimestamp('2026-10-19T10:00:00'));
    for (const muscle of ['chest', 'back', 'shoulders', 'arms']) {
      const card = result.cards.find(c => c.muscle === muscle);
      expect(card?.recovered).toBeLessThan(70);
      expect(card?.recovered).toBeGreaterThanOrEqual(40);
      expect(card?.status).not.toBe('Fresh');
    }
  });
  it('keeps recently worked groups non-fresh even at over 85%', () => {
    const result = computeGarminRecovery([activity({ name: 'Upper body', duration_seconds: 60 })], [], pacificTimestamp('2026-10-19T10:00:00'));
    const chest = result.cards.find(c => c.muscle === 'chest');
    expect(chest?.recovered).toBeGreaterThanOrEqual(85);
    expect(chest?.status).not.toBe('Fresh');
  });
  it('retains named evidence for row groups and estimated evidence for unlisted chest', () => {
    const loads = sessionMuscleLoads(upper);
    expect(loads.find(c => c.muscle === 'back')?.evidence).toBe('named');
    expect(loads.find(c => c.muscle === 'chest')?.evidence).toBe('estimated');
  });
  it('infers upper from named exercises even without a split title', () => {
    const loads = sessionMuscleLoads({ ...upper, name: 'Strength' });
    expect(loads.map(c => c.muscle).sort()).toEqual(['arms','back','chest','shoulders']);
  });
  it('duration and recorded sets both increase session workload', () => {
    const short = sessionMuscleLoads(upper).find(c => c.muscle === 'chest')?.load ?? 0;
    const long = sessionMuscleLoads({ ...upper, duration_seconds: 40 * 60 }).find(c => c.muscle === 'chest')?.load ?? 0;
    const sets = sessionMuscleLoads({ ...upper, raw: { summarizedExerciseSets: [{ category: 'ROW', sets: 16, reps: 7 }] } }).find(c => c.muscle === 'chest')?.load ?? 0;
    expect(long).toBeGreaterThan(short); expect(sets).toBeGreaterThan(long);
  });
});
