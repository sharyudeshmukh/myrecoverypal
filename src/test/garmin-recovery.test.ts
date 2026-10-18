import { describe, expect, it } from 'vitest';
import { computeGarminRecovery, decayRate, remainingFatigue, sessionMuscleLoads, todayRecoveryBattery } from '@/lib/garmin-recovery';
import type { Daily, Workout } from '@/lib/fitness-dashboard';
const activity = (overrides: Partial<Workout> = {}): Workout => ({ activity_id: 1, name: 'Workout', type: 'strength_training', start_time_local: '2026-10-18T10:00:00', duration_seconds: 2700, avg_hr: 100, raw: null, ...overrides } as Workout);
const now = new Date('2026-10-18T12:00:00').getTime();
describe('automatic Garmin recovery', () => {
  it('maps named categories with 100% primary and 50% secondary load', () => {
    const loads = sessionMuscleLoads(activity({ raw: { summarizedExerciseSets: [{ category: 'BENCH_PRESS', sets: 3, reps: 10 }] } }));
    expect(loads.find(l => l.muscle === 'chest')?.load).toBe(55);
    expect(loads.find(l => l.muscle === 'arms')?.load).toBe(27.5);
    expect(loads.some(l => l.muscle === 'quads')).toBe(false);
  });
  it('uses duration when reps are missing', () => {
    const load = sessionMuscleLoads(activity({ raw: { summarizedExerciseSets: [{ category: 'PLANK', sets: 2, duration: 30 }] } }));
    expect(load.find(l => l.muscle === 'core')?.load).toBe(55);
  });
  it('spreads unknown strength evenly over all nine groups, scaled by duration and HR', () => {
    const loads = sessionMuscleLoads(activity({ raw: { summarizedExerciseSets: [{ category: 'UNKNOWN' }] } }));
    expect(loads).toHaveLength(9);
    expect(loads.every(l => l.load === 45 && l.evidence === 'estimated')).toBe(true);
    expect(sessionMuscleLoads(activity({ duration_seconds: 5400, avg_hr: 120 }))[0]?.load).toBe(108);
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
  it('decays large muscles 90% by 48h and small muscles by 36h', () => {
    expect(remainingFatigue(100, 48, 'quads', null)).toBeCloseTo(10);
    expect(remainingFatigue(100, 36, 'arms', null)).toBeCloseTo(10);
  });
  it('slows decay 25% below battery 40 and accelerates at 70', () => {
    expect(decayRate(39)).toBe(0.75);
    expect(decayRate(40)).toBe(1);
    expect(decayRate(69)).toBe(1);
    expect(decayRate(70)).toBe(1.1);
    expect(remainingFatigue(100, 48, 'chest', 39)).toBeGreaterThan(remainingFatigue(100, 48, 'chest', 40));
  });
  it('uses only today’s battery, including zero', () => {
    const daily = [{ date: '2026-10-18', body_battery_high: 80, raw: { stats: { bodyBatteryMostRecentValue: 0 } } }] as Daily[];
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