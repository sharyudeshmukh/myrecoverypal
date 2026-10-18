import { describe, it, expect } from 'vitest';
import { nextWorkout, effectiveMaxHr, zoneRange, goalInsights, progressiveOverload, leastRecentlyTrained, exerciseOptions, muscleForExercise, type Goals, type StrengthSet } from '@/lib/goals';
import type { Daily, Workout } from '@/lib/fitness-dashboard';

const TODAY = '2026-10-18';
const goals: Goals = {
  user_id: 'u1', goal: 'Lose weight + build muscle', current_weight: 80, target_weight: 75, units: 'kg',
  age: 30, max_hr: null, steps_goal: 10000, strength_target: 3, cardio_minutes_target: 150,
  updated_at: '2026-10-18T00:00:00Z',
};
function daily(over: Partial<Daily> & { date: string }): Daily {
  const { date, ...rest } = over;
  return {
    date, sleep_score: null, sleep_seconds: null, deep_sleep_seconds: null, rem_sleep_seconds: null,
    light_sleep_seconds: null, awake_seconds: null, resting_hr: null, hrv_last_night_avg: null, hrv_weekly_avg: null,
    training_readiness: null, stress_avg: null, stress_max: null, body_battery_high: null, body_battery_low: null,
    body_battery_charged: null, body_battery_drained: null, body_battery_wake: null, steps: null, active_kcal: null,
    intensity_minutes: null, hrv_status: null, training_readiness_level: null, raw: null, ...rest,
  };
}
function workout(over: Partial<Workout> & { activity_id: number; date: string; type: string }): Workout {
  const { date, ...rest } = over;
  return {
    name: null, start_time_local: `${date} 08:00:00`, duration_seconds: 2400, distance_meters: null, avg_hr: 120,
    max_hr: 150, calories: 300, aerobic_te: null, anaerobic_te: null, training_load: null, avg_pace_or_speed: null,
    elevation_gain: null, raw: null, ...rest,
  };
}
function strengthSet(activity_id: number, exercise: string, muscle_group: string, reps: number, weight: number): StrengthSet {
  return { id: `s-${activity_id}-${exercise}`, user_id: 'u1', activity_id, exercise, muscle_group, set_number: 1, reps, weight, created_at: '2026-10-18T00:00:00Z' };
}

describe('effectiveMaxHr', () => {
  it('uses age when no explicit max HR', () => expect(effectiveMaxHr(goals, [], TODAY)).toBe(190));
  it('falls back to the highest max HR in raw stats of the last 90 days', () => {
    const d = daily({ date: TODAY, raw: { stats: { maxHeartRate: 172 } } });
    expect(effectiveMaxHr({ ...goals, age: null }, [d], TODAY)).toBe(172);
  });
  it('prefers the explicit max HR', () => expect(effectiveMaxHr({ ...goals, max_hr: 185 }, [], TODAY)).toBe(185));
});

describe('HR zones', () => {
  it('zone 2 is 60–70% of max HR', () => expect(zoneRange(190, 2)).toEqual([114, 133]));
});

describe('nextWorkout rules', () => {
  it('recovery when Body Battery is under 25', () => {
    const d = daily({ date: TODAY, raw: { stats: { bodyBatteryMostRecentValue: 18 } } });
    expect(nextWorkout([d], [], goals, [], TODAY).type).toBe('recovery');
  });
  it('recovery after 4+ consecutive training days', () => {
    const acts = [0, 1, 2, 3].map((i) => workout({ activity_id: i, date: `2026-10-${18 - i}`, type: 'running' }));
    expect(nextWorkout([], acts, goals, [], TODAY).type).toBe('recovery');
  });
  it('zone 2 cardio when strength was yesterday', () => {
    const acts = [workout({ activity_id: 1, date: '2026-10-17', type: 'strength_training' })];
    const next = nextWorkout([], acts, goals, [], TODAY);
    expect(next.type).toBe('cardio');
    expect(next.intensity).toContain('114–133');
  });
  it('strength when 2+ days since strength, battery is 40+, and cardio is on track', () => {
    const d = daily({ date: TODAY, raw: { stats: { bodyBatteryMostRecentValue: 70 } } });
    const acts = [workout({ activity_id: 1, date: '2026-10-15', type: 'strength_training' }), workout({ activity_id: 2, date: '2026-10-16', type: 'running', duration_seconds: 9000 })];
    const next = nextWorkout([d], acts, goals, [strengthSet(1, 'Squat', 'quads', 5, 60)], TODAY);
    expect(next.type).toBe('strength');
    expect(next.muscleGroups).toBeTruthy();
  });
  it('prefers cardio when cardio minutes are behind target even if strength is due', () => {
    const d = daily({ date: TODAY, raw: { stats: { bodyBatteryMostRecentValue: 60 } } });
    const acts = [workout({ activity_id: 1, date: '2026-10-14', type: 'strength_training' }), workout({ activity_id: 2, date: '2026-10-15', type: 'strength_training' }), workout({ activity_id: 3, date: '2026-10-16', type: 'strength_training' })];
    expect(nextWorkout([d], acts, goals, [], TODAY).type).toBe('cardio');
  });
  it('no activities at all falls back to cardio when behind', () => {
    expect(nextWorkout([], [], goals, [], TODAY).type).toBe('cardio');
  });
});

describe('muscle suggestions and overload', () => {
  it('next workout suggests freshest Garmin muscles even without manual strength logs', () => {
    const acts = [workout({ activity_id: 1, date: TODAY, type: 'running', duration_seconds: 9000 })];
    const next = nextWorkout([], acts, goals, [], TODAY);
    expect(next.type).toBe('strength');
    expect(next.muscleGroups).toEqual(['chest', 'back', 'shoulders']);
  });
  it('suggests least recently trained muscle groups', () => {
    const acts = [workout({ activity_id: 1, date: '2026-10-10', type: 'strength_training' }), workout({ activity_id: 2, date: '2026-10-12', type: 'strength_training' })];
    const sets = [strengthSet(1, 'Squat', 'quads', 5, 60), strengthSet(2, 'Bench press', 'chest', 5, 40)];
    const result = leastRecentlyTrained(sets, acts, TODAY);
    expect(result).toHaveLength(3);
    expect(result[0]).not.toBe('quads');
    expect(result[0]).not.toBe('chest');
  });
  it('flags progressive overload when weight increased vs last time', () => {
    const acts = [workout({ activity_id: 1, date: '2026-10-10', type: 'strength_training' }), workout({ activity_id: 2, date: '2026-10-16', type: 'strength_training' })];
    const sets = [strengthSet(1, 'Squat', 'quads', 5, 60), strengthSet(2, 'Squat', 'quads', 5, 70)];
    const notes = progressiveOverload(sets, acts, TODAY);
    expect(notes[0]).toContain('Squat');
    expect(notes[0]).toContain('+10.0');
  });
});

describe('insights feed', () => {
  it('compares workouts between the last and previous 7 days', () => {
    const acts = [workout({ activity_id: 1, date: '2026-10-17', type: 'running' }), workout({ activity_id: 2, date: '2026-10-12', type: 'running' }), workout({ activity_id: 3, date: '2026-10-09', type: 'strength_training' })];
    const { insights } = goalInsights([], acts, [], [], goals, TODAY);
    const rhythm = insights.find((i) => i.title === 'Training rhythm');
    expect(rhythm?.text).toContain('2 workouts in the last 7 days');
    expect(rhythm?.text).toContain('up from 1');
  });
  it('never fabricates weight without logged entries', () => {
    const { insights } = goalInsights([], [], [], [], goals, TODAY);
    expect(insights.find((i) => i.title === 'Weight trend')?.text).toContain('No weight logged yet');
  });
  it('recommends cardio when behind weekly target', () => {
    const { recommendation } = goalInsights([], [], [], [], goals, TODAY);
    expect(recommendation).toContain('cardio minutes short');
  });
});

describe('exercise mapping', () => {
  it('maps exercise names to muscle groups', () => {
    expect(muscleForExercise('Squat')).toBe('quads');
    expect(muscleForExercise('Bench press')).toBe('chest');
  });
  it('searches exercises by name', () => {
    expect(exerciseOptions('curl').map((o) => o.exercise)).toContain('Bicep curl');
  });
});
