import { describe, it, expect } from 'vitest';
import { nextWorkout, cardioBudget, cardioLeadStreak, effectiveMaxHr, zoneRange, goalInsights, progressiveOverload, leastRecentlyTrained, exerciseOptions, muscleForExercise, type Goals, type StrengthSet } from '@/lib/goals';
import { cardioMinutes, pacificTimestamp, type Daily, type Workout } from '@/lib/fitness-dashboard';

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
  it('current advice changes with synced Body Battery instead of retaining earlier advice', () => {
    const initial = daily({ date: TODAY, raw: { stats: { bodyBatteryMostRecentValue: 18 } } });
    const synced = daily({ date: TODAY, raw: { stats: { bodyBatteryMostRecentValue: 78 } } });
    const history = [{ for_date: TODAY, rec_type: 'recovery' as const }];
    expect(nextWorkout([initial], [], goals, [], TODAY, undefined, history).type).toBe('recovery');
    expect(nextWorkout([synced], [], goals, [], TODAY, undefined, history).type).toBe('strength');
    expect(history[0]?.rec_type).toBe('recovery');
  });
  it('recovery when Body Battery is under 25', () => {
    const d = daily({ date: TODAY, raw: { stats: { bodyBatteryMostRecentValue: 18 } } });
    expect(nextWorkout([d], [], goals, [], TODAY).type).toBe('recovery');
  });
  it('recovery after 4+ consecutive training days', () => {
    const acts = [0, 1, 2, 3].map((i) => workout({ activity_id: i, date: `2026-10-${18 - i}`, type: 'running' }));
    expect(nextWorkout([], acts, goals, [], TODAY).type).toBe('recovery');
  });
  it('unknown full-body strength yesterday blocks both regions', () => {
    const acts = [workout({ activity_id: 1, date: '2026-10-17', type: 'strength_training' })];
    const next = nextWorkout([], acts, goals, [], TODAY);
    expect(next.type).toBe('cardio');
  });
  it('recommends upper-body strength the day after a lower-body session', () => {
    const yesterday = workout({
      activity_id: 1, date: '2026-10-17', type: 'strength_training',
      raw: { summarizedExerciseSets: [
        { category: 'SQUAT', sets: 3, reps: 6 },
        { category: 'DEADLIFT', sets: 3, reps: 6 },
        { category: 'LUNGE', sets: 3, reps: 10 },
      ] },
    });
    const d = daily({ date: TODAY, sleep_seconds: 26640, raw: { stats: { bodyBatteryMostRecentValue: 78 } } });
    const next = nextWorkout([d], [yesterday], goals, [], TODAY);
    expect(next.type).toBe('strength');
    expect(next.title).toContain('upper');
    expect(next.muscleGroups?.length).toBeGreaterThan(0);
  });
  it('strength when 2+ days since strength, battery is 40+, and cardio is on track', () => {
    const d = daily({ date: TODAY, raw: { stats: { bodyBatteryMostRecentValue: 70 } } });
    const acts = [workout({ activity_id: 1, date: '2026-10-15', type: 'strength_training' }), workout({ activity_id: 2, date: '2026-10-16', type: 'running', duration_seconds: 9000 })];
    const next = nextWorkout([d], acts, goals, [strengthSet(1, 'Squat', 'quads', 5, 60)], TODAY);
    expect(next.type).toBe('strength');
    expect(next.muscleGroups).toBeTruthy();
  });
  it('strength due outranks a cardio deficit with optional finisher', () => {
    const d = daily({ date: TODAY, raw: { stats: { bodyBatteryMostRecentValue: 60 } } });
    const acts = [workout({ activity_id: 1, date: '2026-10-13', type: 'strength_training' }), workout({ activity_id: 2, date: '2026-10-14', type: 'strength_training' }), workout({ activity_id: 3, date: '2026-10-15', type: 'strength_training' })];
    const rec = nextWorkout([d], acts, goals, [], TODAY);
    expect(rec.type).toBe('strength');
    expect(rec.ruleId).toBe('strength_due');
    expect(rec.finisher).toBe('+15-20 min Zone 2 after lifting');
  });
  it('no activities starts with strength for fresh muscles', () => {
    expect(nextWorkout([], [], goals, [], TODAY).type).toBe('strength');
  });
});

describe('muscle suggestions and overload', () => {
  it('next workout suggests freshest Garmin muscles even without manual strength logs', () => {
    const acts = [workout({ activity_id: 1, date: TODAY, type: 'running', duration_seconds: 9000 })];
    const next = nextWorkout([], acts, goals, [], TODAY);
    expect(next.type).toBe('strength');
    expect(next.muscleGroups).toEqual(['chest', 'back', 'shoulders', 'arms']);
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
  it('insight recommendation respects strength-first priority', () => {
    const { recommendation } = goalInsights([], [], [], [], goals, TODAY);
    expect(recommendation).toContain('Strength:');
  });
  it('surfaces a longest-run personal best in the last 4 weeks', () => {
    const acts = [workout({ activity_id: 1, date: '2026-09-01', type: 'running', distance_meters: 4200 }), workout({ activity_id: 2, date: '2026-10-10', type: 'running', distance_meters: 5000 })];
    const { insights } = goalInsights([], acts, [], [], goals, TODAY);
    expect(insights.some((i) => i.title.startsWith('Personal best') && i.text.includes('5.00 km'))).toBe(true);
  });
  it('surfaces a heaviest-lift personal best', () => {
    const acts = [workout({ activity_id: 1, date: '2026-09-01', type: 'strength_training' }), workout({ activity_id: 2, date: '2026-10-16', type: 'strength_training' })];
    const sets = [strengthSet(1, 'Squat', 'quads', 5, 120), strengthSet(2, 'Squat', 'quads', 5, 130)];
    const { insights } = goalInsights([], acts, [], sets, goals, TODAY);
    expect(insights.some((i) => i.title.startsWith('Personal best') && i.text.includes('Squat'))).toBe(true);
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

describe('cardio counting and Pacific day', () => {
  it('counts cycling, swimming and walking as cardio but not strength', async () => {
    const { isCardioType } = await import('@/lib/fitness-dashboard');
    expect(isCardioType('indoor_cycling')).toBe(true);
    expect(isCardioType('lap_swimming')).toBe(true);
    expect(isCardioType('walking')).toBe(true);
    expect(isCardioType('strength_training')).toBe(false);
  });
  it('a 150-min bike week means cardio is on target', () => {
    const acts = [workout({ activity_id: 9, date: '2026-10-13', type: 'indoor_cycling', duration_seconds: 9000 })];
    expect(nextWorkout([], acts, goals, [], '2026-10-14').ruleId).not.toBe('cardio_behind_target');
  });
  it('uses the Seattle calendar day, not UTC', async () => {
    const { pacificToday } = await import('@/lib/fitness-dashboard');
    expect(pacificToday(Date.parse('2026-10-20T04:05:00Z'))).toBe('2026-10-19');
  });
});

const V2_DATE = '2026-10-21';
function heavy(date: string, raw: Workout['raw'] = null) { return workout({activity_id: 500,date,type:'strength_training',duration_seconds:36000,raw}); }
describe('v3 regional priorities and retained cardio limits', () => {
  it('strength due cannot override unready regions', () => {
    const rec = nextWorkout([], [heavy('2026-10-19')], goals, [], V2_DATE);
    expect(rec.type).toBe('cardio'); expect(rec.ruleId).toBe('cardio_far_behind_pace');
  });
  it('a single fresh group is not enough for a region', () => {
    const named = ['BENCH_PRESS','ROW','SHOULDER_PRESS','CURL','PLANK','SQUAT','DEADLIFT'].map(category => ({category,sets:100,reps:100}));
    const rec = nextWorkout([], [heavy('2026-10-20',{summarizedExerciseSets:named})], goals, [], V2_DATE);
    expect(rec.type).toBe('cardio'); expect(rec.muscleGroups).toBeUndefined();
  });
  it('cardio after yesterday strength requires no fresh group', () => {
    const rec = nextWorkout([], [heavy('2026-10-20')], goals, [], V2_DATE);
    expect(rec.type).toBe('cardio'); expect(rec.ruleId).toBe('strength_yesterday_cardio');
    expect(rec.strengthBlockedReason).toBeTruthy();
  });
  it('far-behind pace allows cardio only after a two-day cardio gap', () => {
    const oldCardio = workout({activity_id:501,date:'2026-10-19',type:'walking',duration_seconds:600});
    expect(nextWorkout([], [heavy(V2_DATE),oldCardio],goals,[],V2_DATE).ruleId).toBe('cardio_far_behind_pace');
    expect(nextWorkout([], [heavy(V2_DATE),{...oldCardio,start_time_local:'2026-10-20T08:00:00'}],goals,[],V2_DATE).type).toBe('recovery');
  });
  it('at exactly half of elapsed pace cardio does not win', () => {
    const a = workout({activity_id:501,date:'2026-10-19',type:'cycling',duration_seconds:(150*3/7*.5)*60});
    expect(cardioBudget([a],goals,V2_DATE).farBehind).toBe(false);
    expect(nextWorkout([], [heavy(V2_DATE),a],goals,[],V2_DATE).type).toBe('recovery');
  });
  it('two consecutive frozen cardio leads cap the third but not recovery', () => {
    const history = [{for_date:'2026-10-19',rec_type:'cardio' as const},{for_date:'2026-10-20',rec_type:'cardio' as const}];
    expect(cardioLeadStreak(history,V2_DATE)).toBe(2);
    expect(nextWorkout([], [heavy('2026-10-20')],goals,[],V2_DATE,undefined,history).ruleId).toBe('cardio_lead_cap_recovery');
    const d = daily({date:V2_DATE,raw:{stats:{bodyBatteryMostRecentValue:24}}});
    expect(nextWorkout([d],[],goals,[],V2_DATE,undefined,history).ruleId).toBe('low_bb_recovery');
  });
  it('one cardio lead or a date gap does not trigger the cap', () => {
    expect(cardioLeadStreak([{for_date:'2026-10-19',rec_type:'cardio'}],V2_DATE)).toBe(0);
    expect(nextWorkout([], [heavy('2026-10-20')],goals,[],V2_DATE,undefined,[{for_date:'2026-10-20',rec_type:'cardio'}]).type).toBe('cardio');
  });
  it('shared rolling seven-day cardio includes all aerobic workout types, not future or older dates', () => {
    const acts = ['running','walking','cycling','zone_2','indoor_cardio'].map((type,i)=>workout({activity_id:i,date:'2026-10-15',type,duration_seconds:600}));
    acts.push(workout({activity_id:8,date:'2026-10-14',type:'running',duration_seconds:600}),workout({activity_id:9,date:'2026-10-22',type:'cycling',duration_seconds:600}),heavy('2026-10-20'));
    expect(cardioMinutes(acts,'2026-10-15',V2_DATE)).toBe(50);
    const b = cardioBudget(acts,goals,V2_DATE);
    expect(b.actual).toBe(50); expect(b.daysElapsed).toBe(3); expect(b.pace).toBeCloseTo(150*3/7); expect(b.behind).toBe(true);
  });
  it('Seattle timestamps use DST and standard time correctly', () => {
    expect(pacificTimestamp('2026-10-21T08:00:00')).toBe(Date.parse('2026-10-21T15:00:00Z'));
    expect(pacificTimestamp('2026-12-21T08:00:00')).toBe(Date.parse('2026-12-21T16:00:00Z'));
  });
});

describe('v3 no same-region strength within 48h', () => {
  const date = '2026-10-22';
  const upper = workout({ activity_id: 901, date: '2026-10-21', type: 'strength_training', name: 'Upper body', duration_seconds: 32 * 60, raw: { summarizedExerciseSets: [{ category: 'ROW', sets: 1, reps: 7 }] } });
  it('upper yesterday chooses fresh lower, never upper', () => {
    const rec = nextWorkout([], [upper], goals, [], date);
    expect(rec.type).toBe('strength'); expect(rec.title).toBe('Strength: lower body');
    expect(rec.muscleGroups).toEqual(['quads', 'hamstrings', 'glutes', 'calves']);
  });
  it('lower yesterday chooses fresh upper, never lower', () => {
    const rec = nextWorkout([], [{ ...upper, name: 'Lower body', raw: { summarizedExerciseSets: [{ category: 'SQUAT', sets: 3, reps: 8 }] } }], goals, [], date);
    expect(rec.type).toBe('strength'); expect(rec.title).toBe('Strength: upper body');
  });
  it('48-hour guard applies to elapsed hours, not two calendar dates', () => {
    const rec = nextWorkout([], [{ ...upper, start_time_local: '2026-10-20T20:00:00' }], goals, [], date, pacificTimestamp('2026-10-22T11:00:00'));
    expect(rec.title).toBe('Strength: lower body');
  });
  it('recent leg cardio can leave neither region fresh after upper strength', () => {
    const cardio = workout({activity_id:902,date:'2026-10-21',type:'running',duration_seconds:28*60});
    expect(nextWorkout([], [upper,cardio], goals, [], date).type).toBe('cardio');
  });
});
