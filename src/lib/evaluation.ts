import type { Json } from '@/integrations/supabase/types';
import { isCardioType, pacificTimestamp, shiftDate, weekStart, workoutType, type Daily, type Workout } from './fitness-dashboard';
import { nextWorkout, trainingFacts, cardioBudget, effectiveMaxHr, DEFAULT_GOALS, timeInZones, type Goals, type StrengthSet, type NextWorkout, type RecommendationHistory } from './goals';
import { computeGarminRecovery } from './garmin-recovery';

export type Adherence = 'followed' | 'partial' | 'swapped' | 'skipped';
export type RecommendationLog = {
  user_id: string; for_date: string; generated_at: string; rec_type: NextWorkout['type'];
  target_muscles: string[]; duration_min: number; hr_low: number | null; hr_high: number | null;
  rules_version: 'v1' | 'v2' | 'v3';
  rule_id: string; inputs: Json; recommendation: NextWorkout; source: 'live' | 'replay';
};
export type EvaluatedLog = RecommendationLog & {
  adherence: Adherence | null; actual_activity_ids: number[]; uncertain: boolean;
  battery: number | null; restingHr: number | null; stress: number | null;
  strengthMet: boolean | null; cardioMet: boolean | null;
};
const dayOf = (a: Workout) => a.start_time_local?.slice(0, 10) ?? '';
const isCardio = (a: Workout) => isCardioType(a.type);

// All callers share the current engine; replay explicitly excludes target-day data.
export function freezeRecommendation(daily: Daily[], activities: Workout[], goals: Goals | null, sets: StrengthSet[], forDate: string, userId: string, source: RecommendationLog['source'], generatedAt = new Date().toISOString(), history: RecommendationHistory[] = []): RecommendationLog {
  const d = daily.filter(x => source === 'replay' ? x.date < forDate : x.date <= forDate);
  // Never evaluate a recommendation using the workout it is meant to predict.
  const a = activities.filter(x => dayOf(x) < forDate && dayOf(x) >= shiftDate(forDate, -90));
  const ids = new Set(a.map(x => x.activity_id));
  const s = sets.filter(x => ids.has(x.activity_id) && x.created_at < `${forDate}T00:00:00`);
  const now = pacificTimestamp(`${forDate}T08:00:00`);
  const priorHistory = history.filter(r => r.for_date < forDate).map(r => ({ for_date: r.for_date, rec_type: r.rec_type }));
  const rec = nextWorkout(d, a, goals, s, forDate, now, priorHistory);
  const facts = trainingFacts(d, a, forDate);
  const maxHr = effectiveMaxHr(goals, d, forDate);
  const recovery = computeGarminRecovery(a, d, now);
  return {
    user_id: userId, for_date: forDate, generated_at: generatedAt, rec_type: rec.type, rules_version: 'v3',
    target_muscles: rec.muscleGroups ?? [], duration_min: rec.type === 'strength' ? 40 : 30,
    hr_low: rec.type === 'cardio' ? Math.round(maxHr * .6) : null,
    hr_high: rec.type === 'strength' ? null : Math.round(maxHr * (rec.type === 'cardio' ? .7 : .6)),
    rule_id: rec.ruleId, recommendation: rec, source,
    inputs: JSON.parse(JSON.stringify({ engine_version: 'nextrep-v3', decision_time: '08:00 America/Los_Angeles', facts, cardio_budget: cardioBudget(a, goals, forDate), prior_recommendations: priorHistory.slice(-2), max_hr: maxHr, goals: goals ?? DEFAULT_GOALS, muscle_recovery: recovery.cards, daily: d, activities: a, strength_sets: s, historical_settings_unavailable: source === 'replay' })) as Json,
  };
}

export function classifyAdherence(rec: RecommendationLog, activities: Workout[]): { adherence: Adherence; actual_activity_ids: number[]; uncertain: boolean } {
  const actual = activities.filter(a => dayOf(a) === rec.for_date);
  const ids = actual.map(a => a.activity_id);
  if (rec.rec_type === 'recovery') {
    const hard = actual.some(a => workoutType(a.type) === 'strength_training' || timeInZones(a).filter(z => z.zone >= 4).reduce((n,z) => n + z.minutes, 0) >= 10);
    const uncertain = !hard && actual.some(a => {
      const raw = a.raw as Record<string, unknown> | null;
      return typeof raw?.['hrTimeInZone_4'] !== 'number' || typeof raw?.['hrTimeInZone_5'] !== 'number';
    });
    return { adherence: hard ? 'swapped' : 'followed', actual_activity_ids: ids, uncertain };
  }
  if (!actual.length) return { adherence: 'skipped', actual_activity_ids: ids, uncertain: false };
  const matches = actual.filter(a => rec.rec_type === 'strength' ? workoutType(a.type) === 'strength_training' : isCardio(a));
  if (!matches.length) return { adherence: 'swapped', actual_activity_ids: ids, uncertain: false };
  const duration = matches.reduce((n,a) => n + (a.duration_seconds ?? 0) / 60, 0);
  return { adherence: duration < rec.duration_min * .6 ? 'partial' : 'followed', actual_activity_ids: ids, uncertain: matches.some(a => a.duration_seconds === null) };
}

export function weekProgress(activities: Workout[], start: string, strengthTarget: number, cardioTarget: number) {
  const end = shiftDate(start, 6);
  const a = activities.filter(x => dayOf(x) >= start && dayOf(x) <= end);
  return { strengthMet: a.filter(x => workoutType(x.type) === 'strength_training').length >= strengthTarget, cardioMet: a.filter(isCardio).reduce((n,x) => n + (x.duration_seconds ?? 0)/60,0) >= cardioTarget };
}
export function evaluateLogs(logs: RecommendationLog[], daily: Daily[], activities: Workout[], today: string): EvaluatedLog[] {
  return logs.map(rec => {
    const next = daily.find(d => d.date === shiftDate(rec.for_date, 1));
    const inputs = rec.inputs as { goals?: { strength_target?: number; cardio_minutes_target?: number } } | null;
    const start = weekStart(rec.for_date);
    const week = shiftDate(start, 6) < today ? weekProgress(activities, start, inputs?.goals?.strength_target ?? 3, inputs?.goals?.cardio_minutes_target ?? 150) : { strengthMet: null, cardioMet: null };
    const past = rec.for_date < today;
    const result = classifyAdherence(rec, activities);
    return { ...rec, ...week, adherence: past ? result.adherence : null, actual_activity_ids: past ? result.actual_activity_ids : [], uncertain: result.uncertain,
      battery: past ? next?.body_battery_wake ?? next?.body_battery_high ?? null : null,
      restingHr: past && next?.sleep_seconds != null ? next.resting_hr : null,
      stress: past && next?.stress_avg != null && next.stress_avg >= 0 ? next.stress_avg : null };
  });
}

export function seededRandom(seed = 20261018) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const mean = (a: number[]) => a.reduce((s,v) => s+v,0)/a.length;
// Percentile bootstrap of the mean difference, independent resampling within groups.
export function bootstrapDifference(followed: number[], other: number[], draws = 2000) {
  const x = followed.filter(Number.isFinite), y = other.filter(Number.isFinite);
  const missing = Math.max(0,8-x.length) + Math.max(0,8-y.length);
  if (missing) return { nFollowed: x.length, nOther: y.length, missing, estimate: null, low: null, high: null, followedMean: null, otherMean: null };
  const random = seededRandom();
  const sample = (v: number[]) => Array.from({ length: v.length }, () => v[Math.floor(random()*v.length)] ?? 0);
  const deltas = Array.from({length: draws}, () => mean(sample(x))-mean(sample(y))).sort((a,b)=>a-b);
  return { nFollowed: x.length, nOther: y.length, missing: 0, estimate: mean(x)-mean(y), low: deltas[Math.floor(draws*.05)] ?? 0, high: deltas[Math.ceil(draws*.95)-1] ?? 0, followedMean: mean(x), otherMean: mean(y) };
}
export function replayHistory(daily: Daily[], activities: Workout[], goals: Goals | null, sets: StrengthSet[], userId: string, today: string) {
  const logs: RecommendationLog[] = [];
  for (const d of [...daily].sort((a,b)=>a.date.localeCompare(b.date)).filter(d=>d.date < today)) logs.push(freezeRecommendation(daily,activities,goals,sets,d.date,userId,'replay',undefined,logs));
  return logs;
}
export function filterEvaluationVersions(logs: RecommendationLog[], version: 'all' | 'v1' | 'v2' | 'v3') {
  return logs.filter(r => version === 'all' || r.rules_version === version);
}