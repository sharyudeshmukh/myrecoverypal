import { workoutType, pacificToday, pacificTimestamp, type Workout, type Daily } from '@/lib/fitness-dashboard';

export const RECOVERY_MUSCLES = ['chest', 'back', 'shoulders', 'arms', 'core', 'quads', 'hamstrings', 'glutes', 'calves'] as const;
export type RecoveryMuscle = typeof RECOVERY_MUSCLES[number];
type Mapping = { primary: RecoveryMuscle[]; secondary: RecoveryMuscle[] };
export const EXERCISE_MUSCLES: Record<string, Mapping> = {
  PUSH_UP: { primary: ['chest'], secondary: ['arms', 'shoulders', 'core'] },
  BENCH_PRESS: { primary: ['chest'], secondary: ['arms', 'shoulders'] },
  CHEST_PRESS: { primary: ['chest'], secondary: ['arms', 'shoulders'] },
  FLY: { primary: ['chest'], secondary: ['shoulders'] },
  SQUAT: { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'core'] },
  LEG_PRESS: { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'calves'] },
  LEG_EXTENSION: { primary: ['quads'], secondary: [] },
  DEADLIFT: { primary: ['hamstrings', 'glutes', 'back'], secondary: ['quads', 'core'] },
  ROMANIAN_DEADLIFT: { primary: ['hamstrings', 'glutes'], secondary: ['back', 'core'] },
  LEG_CURL: { primary: ['hamstrings'], secondary: [] },
  ROW: { primary: ['back'], secondary: ['arms', 'shoulders'] },
  PULL_UP: { primary: ['back'], secondary: ['arms', 'core'] },
  PULL_DOWN: { primary: ['back'], secondary: ['arms'] },
  LAT_PULLDOWN: { primary: ['back'], secondary: ['arms'] },
  LUNGE: { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'calves', 'core'] },
  STEP_UP: { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'calves'] },
  SHOULDER_PRESS: { primary: ['shoulders'], secondary: ['arms', 'core'] },
  CURL: { primary: ['arms'], secondary: [] },
  TRICEPS_EXTENSION: { primary: ['arms'], secondary: [] },
  TRICEPS_PRESS: { primary: ['arms'], secondary: [] },
  DIP: { primary: ['arms', 'chest'], secondary: ['shoulders'] },
  PLANK: { primary: ['core'], secondary: ['shoulders'] },
  CRUNCH: { primary: ['core'], secondary: [] },
  SIT_UP: { primary: ['core'], secondary: [] },
  LEG_RAISE: { primary: ['core'], secondary: [] },
  CALF_RAISE: { primary: ['calves'], secondary: [] },
  HIP_RAISE: { primary: ['glutes'], secondary: ['hamstrings', 'core'] },
  HIP_THRUST: { primary: ['glutes'], secondary: ['hamstrings', 'core'] },
  LATERAL_RAISE: { primary: ['shoulders'], secondary: [] },
  FRONT_RAISE: { primary: ['shoulders'], secondary: [] },
};
const large = new Set<RecoveryMuscle>(['quads', 'hamstrings', 'glutes', 'back', 'chest']);
export function decayRate(battery: number | null) { return battery !== null && battery < 40 ? 0.75 : battery !== null && battery >= 70 ? 1.1 : 1; }
export function remainingFatigue(load: number, hours: number, muscle: RecoveryMuscle, battery: number | null) {
  // 90% of a single session's fatigue dissipates by the recovery horizon.
  return load * Math.exp(-Math.log(10) * Math.max(0, hours) * decayRate(battery) / (large.has(muscle) ? 48 : 36));
}
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function positive(value: unknown) { return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null; }
export function todayRecoveryBattery(daily: Daily[], today: string): number | null {
  const day = daily.find(d => d.date === today);
  if (!day) return null;
  const current = record(record(day.raw)['stats'])['bodyBatteryMostRecentValue'];
  return typeof current === 'number' && Number.isFinite(current) && current >= 0 ? current : day.body_battery_high;
}
export type RecoveryCause = { activityId: number; name: string; date: string; load: number; remaining: number; evidence: 'named' | 'estimated' | 'cardio' };
export type MuscleRecovery = { muscle: RecoveryMuscle; recovered: number; fatigue: number; status: 'Fresh' | 'Recovering' | 'Fatigued'; lastWorked: string | null; daysAgo: number | null; causes: RecoveryCause[]; estimated: boolean };
export function sessionMuscleLoads(activity: Workout): { muscle: RecoveryMuscle; load: number; evidence: RecoveryCause['evidence'] }[] {
  const type = workoutType(activity.type), raw = record(activity.raw);
  const minutes = (positive(activity.duration_seconds) ?? 0) / 60;
  const hrFactor = Math.min(1.6, Math.max(0.6, (positive(activity.avg_hr) ?? 100) / 100));
  const loads = new Map<RecoveryMuscle, { load: number; evidence: RecoveryCause['evidence'] }>();
  const add = (muscle: RecoveryMuscle, load: number, evidence: RecoveryCause['evidence']) => {
    if (load <= 0) return;
    const prior = loads.get(muscle);
    loads.set(muscle, { load: (prior?.load ?? 0) + load, evidence: prior?.evidence === 'estimated' ? 'estimated' : evidence });
  };
  if (type === 'strength_training') {
    const sets = Array.isArray(raw['summarizedExerciseSets']) ? raw['summarizedExerciseSets'].map(record) : [];
    let unknown = 0;
    for (const set of sets) {
      const category = typeof set['category'] === 'string' ? set['category'].toUpperCase().replace(/[ -]/g, '_') : 'UNKNOWN';
      const mapping = EXERCISE_MUSCLES[category];
      if (!mapping) { unknown++; continue; }
      const count = positive(set['sets']) ?? positive(set['setCount']) ?? positive(set['numSets']) ?? 1;
      const reps = positive(set['reps']) ?? positive(set['repetitionCount']);
      const duration = positive(set['duration']) ?? positive(set['durationSeconds']);
      // Repetition load, or timed work in equivalent two-second repetitions.
      const work = reps !== null ? count * reps : duration !== null ? count * duration / 2 : 0;
      mapping.primary.forEach(m => add(m, work / 30 * 55, 'named'));
      mapping.secondary.forEach(m => add(m, work / 30 * 55 * 0.5, 'named'));
    }
    if (!sets.length || unknown > 0) {
      const fraction = sets.length ? unknown / sets.length : 1;
      // Equal full-body distribution; 45 minutes at 100 bpm gives 45 fatigue/group.
      RECOVERY_MUSCLES.forEach(m => add(m, minutes * hrFactor * fraction, 'estimated'));
    }
  } else if (['running', 'treadmill_running', 'indoor_cardio'].includes(type)) {
    const hardMinutes = [3, 4, 5].reduce((sum, z) => sum + (positive(raw[`hrTimeInZone_${z}`]) ?? 0) / 60, 0);
    const zoneFactor = 1 + (minutes > 0 ? Math.min(1, hardMinutes / minutes) : 0);
    const legLoad = minutes * zoneFactor;
    const legs: RecoveryMuscle[] = ['quads', 'hamstrings', 'calves', 'glutes'];
    if (type === 'indoor_cardio') {
      RECOVERY_MUSCLES.forEach(m => add(m, legLoad * 0.15, 'cardio'));
      legs.forEach(m => add(m, legLoad * 0.35, 'cardio'));
    } else legs.forEach(m => add(m, legLoad, 'cardio'));
  }
  return [...loads.entries()].map(([muscle, item]) => ({ muscle, ...item }));
}
export function computeGarminRecovery(activities: Workout[], daily: Daily[], now: number) {
  const today = pacificToday(now);
  const battery = todayRecoveryBattery(daily, today);
  const cards: MuscleRecovery[] = RECOVERY_MUSCLES.map(muscle => ({ muscle, recovered: 100, fatigue: 0, status: 'Fresh', lastWorked: null, daysAgo: null, causes: [], estimated: false }));
  for (const activity of activities) {
    if (!activity.start_time_local) continue;
    const timestamp = pacificTimestamp(activity.start_time_local);
    const hours = (now - timestamp) / 36e5;
    if (!Number.isFinite(hours) || hours < 0 || hours > 7 * 24) continue;
    for (const load of sessionMuscleLoads(activity)) {
      const card = cards.find(c => c.muscle === load.muscle);
      if (!card) continue;
      const remaining = remainingFatigue(load.load, hours, load.muscle, battery);
      card.fatigue += remaining;
      card.estimated ||= load.evidence === 'estimated';
      card.causes.push({ activityId: activity.activity_id, name: activity.name ?? 'Garmin workout', date: activity.start_time_local, load: load.load, remaining, evidence: load.evidence });
    }
  }
  for (const card of cards) {
    card.causes.sort((a, b) => b.date.localeCompare(a.date));
    card.lastWorked = card.causes[0]?.date ?? null;
    card.daysAgo = card.lastWorked ? (now - pacificTimestamp(card.lastWorked)) / 864e5 : null;
    card.recovered = Math.round(100 - Math.min(100, card.fatigue));
    card.status = card.recovered >= 85 ? 'Fresh' : card.recovered >= 50 ? 'Recovering' : 'Fatigued';
  }
  const freshest = [...cards].sort((a, b) => a.fatigue - b.fatigue).slice(0, 3).map(c => c.muscle);
  const upper = cards.filter(c => ['chest', 'back', 'shoulders', 'arms', 'core'].includes(c.muscle));
  const legs = cards.filter(c => ['quads', 'hamstrings', 'glutes', 'calves'].includes(c.muscle));
  const groupState = (list: MuscleRecovery[]) => list.every(c => c.status === 'Fresh') ? 'fresh' : list.some(c => c.status === 'Fatigued') ? 'fatigued' : 'recovering';
  const hasData = cards.some(c => c.causes.length > 0);
  const summary = hasData ? `Upper body ${groupState(upper)}, legs ${groupState(legs)}` : 'No muscle-loading workouts recorded in the last 7 days';
  return { cards, freshest, summary, hasData, battery, overall: Math.round(cards.reduce((sum, c) => sum + c.recovered, 0) / cards.length) };
}