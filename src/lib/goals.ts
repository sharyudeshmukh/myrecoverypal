import type { Tables } from '@/integrations/supabase/types';
import type { Daily, Workout } from '@/lib/fitness-dashboard';
import { isCardioType, cardioMinutes, pacificTimestamp, shiftDate, weekStart, workoutType, average } from '@/lib/fitness-dashboard';
import { computeGarminRecovery } from '@/lib/garmin-recovery';

export type Goals = Tables<'user_goals'>;
export type WeightEntry = Tables<'weight_log'>;
export type StrengthSet = Tables<'strength_sets'>;

export const DEFAULT_GOALS = {
  goal: 'Lose weight + build muscle',
  steps_goal: 10000,
  strength_target: 3,
  cardio_minutes_target: 150,
  units: 'kg',
} as const;

export const MUSCLE_GROUPS = ['chest', 'back', 'shoulders', 'arms', 'core', 'quads', 'hamstrings', 'glutes', 'calves'] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EXERCISES: Record<MuscleGroup, string[]> = {
  chest: ['Bench press', 'Incline bench press', 'Dumbbell fly', 'Push-up', 'Chest press machine', 'Cable crossover', 'Dip'],
  back: ['Deadlift', 'Barbell row', 'Dumbbell row', 'Lat pulldown', 'Pull-up', 'Seated cable row', 'Face pull'],
  shoulders: ['Overhead press', 'Lateral raise', 'Front raise', 'Rear delt fly', 'Arnold press', 'Shoulder press machine'],
  arms: ['Bicep curl', 'Hammer curl', 'Tricep pushdown', 'Skull crusher', 'Tricep dip', 'Preacher curl'],
  core: ['Plank', 'Crunch', 'Hanging leg raise', 'Cable crunch', 'Russian twist', 'Ab rollout', 'Sit-up'],
  quads: ['Squat', 'Front squat', 'Leg press', 'Leg extension', 'Lunge', 'Bulgarian split squat', 'Goblet squat'],
  hamstrings: ['Romanian deadlift', 'Leg curl', 'Good morning', 'Nordic curl', 'Hip hinge', 'Stiff-leg deadlift'],
  glutes: ['Hip thrust', 'Glute bridge', 'Cable kickback', 'Sumo deadlift', 'Step-up', 'Clamshell'],
  calves: ['Standing calf raise', 'Seated calf raise', 'Calf press', 'Donkey calf raise'],
};

export function exerciseOptions(query: string): { exercise: string; muscle: MuscleGroup }[] {
  const q = query.trim().toLowerCase();
  const all = MUSCLE_GROUPS.flatMap((m) => EXERCISES[m].map((e) => ({ exercise: e, muscle: m })));
  if (!q) return all;
  return all.filter((o) => o.exercise.toLowerCase().includes(q));
}

export function muscleForExercise(name: string): MuscleGroup | null {
  const hit = exerciseOptions(name).find((o) => o.exercise.toLowerCase() === name.trim().toLowerCase());
  return hit?.muscle ?? null;
}

// ---- HR zones (percentage of max HR) ----
export const HR_ZONES = [
  { zone: 1, label: 'Very light', low: 0.5, high: 0.6 },
  { zone: 2, label: 'Easy / fat-burn', low: 0.6, high: 0.7 },
  { zone: 3, label: 'Aerobic', low: 0.7, high: 0.8 },
  { zone: 4, label: 'Threshold', low: 0.8, high: 0.9 },
  { zone: 5, label: 'Max effort', low: 0.9, high: 1.0 },
] as const;

export function zoneRange(maxHr: number, zone: number): [number, number] {
  const z = HR_ZONES.find((x) => x.zone === zone) ?? HR_ZONES[1];
  return [Math.round(maxHr * z.low), Math.round(maxHr * z.high)];
}

export function effectiveMaxHr(goals: Goals | null, daily: Daily[], today: string): number {
  if (goals?.max_hr != null) return goals.max_hr;
  if (goals?.age != null) return 220 - goals.age;
  const recent = daily.filter((d) => d.date >= shiftDate(today, -90) && d.date <= today && d.raw != null);
  const maxes = recent.map((d) => rawMaxHr(d)).filter((v): v is number => v !== null);
  return maxes.length ? Math.max(...maxes) : 180;
}

// ---- raw stats helpers (raw.stats.* from Garmin) ----
type RawStats = {
  totalKilocalories?: number;
  activeKilocalories?: number;
  bmrKilocalories?: number;
  minHeartRate?: number;
  maxHeartRate?: number;
  bodyBatteryMostRecentValue?: number;
  restingHeartRate?: number;
};
export function rawStats(d: Daily): RawStats {
  const raw = d.raw as { stats?: RawStats } | null;
  return raw?.stats ?? {};
}
export function rawMaxHr(d: Daily): number | null {
  const v = rawStats(d).maxHeartRate;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
export function latestBattery(daily: Daily[], today: string): number | null {
  const days = daily.filter((d) => d.date <= today).sort((a, b) => b.date.localeCompare(a.date));
  for (const d of days.slice(0, 3)) {
    const cur = rawStats(d).bodyBatteryMostRecentValue;
    if (typeof cur === 'number' && Number.isFinite(cur)) return cur;
  }
  const todayRow = days.find((d) => d.date === today);
  return todayRow?.body_battery_high ?? null;
}
export function timeInZones(a: Workout): { zone: number; minutes: number }[] {
  const raw = a.raw as Record<string, unknown> | null;
  return HR_ZONES.map(({ zone }) => {
    const v = raw?.[`hrTimeInZone_${zone}`];
    return { zone, minutes: typeof v === 'number' && Number.isFinite(v) ? v / 60 : 0 };
  });
}
export type Split = { index: number; distanceKm: number | null; paceMinPerKm: number | null; avgHr: number | null };
export function splits(a: Workout): Split[] {
  const raw = a.raw as { splitSummaries?: unknown } | null;
  if (!Array.isArray(raw?.splitSummaries)) return [];
  return raw.splitSummaries.map((s, i) => {
    const item = (s ?? {}) as Record<string, unknown>;
    const dist = num(item['distance']) ?? null;
    const speed = num(item['averageSpeed']) ?? null;
    return {
      index: i + 1,
      distanceKm: dist === null ? null : dist / 1000,
      paceMinPerKm: dist !== null && dist > 0 && speed !== null && speed > 0 ? 1000 / speed / 60 : null,
      avgHr: num(item['averageHR']) ?? num(item['averageHeartRate']) ?? null,
    };
  });
}
export function avgPaceMinPerKm(a: Workout): number | null {
  if (!a.distance_meters || !a.duration_seconds) return null;
  return a.duration_seconds / 60 / (a.distance_meters / 1000);
}
function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// ---- Training-history analysis ----
export type TrainingFacts = {
  daysSinceStrength: number | null;
  daysSinceCardio: number | null;
  consecutiveDays: number;
  strengthThisWeek: number;
  cardioMinutesThisWeek: number;
  battery: number | null;
  stressToday: number | null;
  sleepLastNight: number | null;
  lastStrengthDate: string | null;
};
export function trainingFacts(daily: Daily[], activities: Workout[], today: string): TrainingFacts {
  const dayOf = (a: Workout) => a.start_time_local?.slice(0, 10) ?? null;
  const past = activities.filter((a) => dayOf(a) !== null && (dayOf(a) as string) <= today);
  const strengthDays = [...new Set(past.filter((a) => workoutType(a.type) === 'strength_training').map((a) => dayOf(a) as string))].sort();
  const cardioDays = [...new Set(past.filter((a) => isCardioType(a.type)).map((a) => dayOf(a) as string))].sort();
  const daysAgo = (date: string) => Math.round((new Date(`${today}T12:00:00Z`).getTime() - new Date(`${date}T12:00:00Z`).getTime()) / 864e5);
  const lastStrengthDate = strengthDays.at(-1) ?? null;
  const lastCardioDate = cardioDays.at(-1) ?? null;
  // consecutive training days ending today or yesterday
  let consecutiveDays = 0;
  let cursor = today;
  const trainingSet = new Set(past.map((a) => dayOf(a) as string));
  if (!trainingSet.has(cursor)) cursor = shiftDate(today, -1);
  while (trainingSet.has(cursor)) {
    consecutiveDays++;
    cursor = shiftDate(cursor, -1);
  }
  const week = weekStart(today);
  const thisWeek = past.filter((a) => (dayOf(a) as string) >= week);
  const todayRow = daily.find((d) => d.date === today);
  return {
    daysSinceStrength: lastStrengthDate ? daysAgo(lastStrengthDate) : null,
    daysSinceCardio: lastCardioDate ? daysAgo(lastCardioDate) : null,
    consecutiveDays,
    strengthThisWeek: thisWeek.filter((a) => workoutType(a.type) === 'strength_training').length,
    cardioMinutesThisWeek: cardioMinutes(past, shiftDate(today, -6), today),
    battery: latestBattery(daily, today),
    stressToday: todayRow?.stress_avg != null && todayRow.stress_avg >= 0 ? todayRow.stress_avg : null,
    sleepLastNight: todayRow?.sleep_seconds ?? null,
    lastStrengthDate,
  };
}

// ---- Next-workout recommendation engine ----
export type NextWorkout = {
  type: 'recovery' | 'cardio' | 'strength';
  ruleId: string;
  title: string;
  duration: string;
  intensity: string;
  why: string[];
  lowEnergy: string;
  muscleGroups?: MuscleGroup[] | undefined;
  rulesVersion?: 'v1' | 'v2';
  finisher?: string;
  strengthBlockedReason?: string;
};
export function leastRecentlyTrained(strengthSets: StrengthSet[], activities: Workout[], today: string): MuscleGroup[] {
  const dateByActivity = new Map(activities.map((a) => [a.activity_id, a.start_time_local?.slice(0, 10) ?? null]));
  const lastByMuscle = new Map<MuscleGroup, string>();
  for (const s of strengthSets) {
    const date = dateByActivity.get(s.activity_id);
    const m = s.muscle_group as MuscleGroup;
    if (!date || !MUSCLE_GROUPS.includes(m)) continue;
    const prev = lastByMuscle.get(m);
    if (!prev || date > prev) lastByMuscle.set(m, date);
  }
  return [...MUSCLE_GROUPS].sort((a, b) => (lastByMuscle.get(a) ?? '0').localeCompare(lastByMuscle.get(b) ?? '0')).slice(0, 3);
}
export type RecommendationHistory = { for_date: string; rec_type: NextWorkout['type'] };
export function cardioLeadStreak(history: RecommendationHistory[], today: string) {
  let count = 0;
  for (let date = shiftDate(today, -1); history.some(r => r.for_date === date && r.rec_type === 'cardio'); date = shiftDate(date, -1)) count++;
  return count;
}
export function cardioBudget(activities: Workout[], goals: Goals | null, today: string) {
  const actual = cardioMinutes(activities, shiftDate(today, -6), today);
  const target = goals?.cardio_minutes_target ?? DEFAULT_GOALS.cardio_minutes_target;
  const daysElapsed = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${weekStart(today)}T12:00:00Z`)) / 864e5) + 1;
  const pace = target * daysElapsed / 7;
  const behind = actual < pace;
  return { actual, target, daysElapsed, pace, behind, farBehind: actual < pace * .5,
    label: `Weekly cardio (last 7 days): ${Math.round(actual)} of ${target} min, ${behind ? 'behind pace' : 'on pace'}` };
}
export function nextWorkout(daily: Daily[], activities: Workout[], goals: Goals | null, strengthSets: StrengthSet[], today: string, now = pacificTimestamp(`${today}T12:00:00`), history: RecommendationHistory[] = []): NextWorkout {
  const f = trainingFacts(daily, activities, today);
  const maxHr = effectiveMaxHr(goals, daily, today);
  const budget = cardioBudget(activities, goals, today);
  const battery = f.battery;
  const batteryText = battery != null ? `Latest Body Battery: ${Math.round(battery)}/100.` : 'No Body Battery reading available.';
  const sleepText = f.sleepLastNight != null ? `Last night's sleep: ${(f.sleepLastNight / 3600).toFixed(1)} h.` : 'No sleep data recorded last night.';
  // Recovery overrides are unchanged.
  if ((battery != null && battery < 25) || f.consecutiveDays >= 4) {
    return { rulesVersion: 'v2', ruleId: battery != null && battery < 25 ? 'low_bb_recovery' : 'consecutive_training_recovery', type: 'recovery', title: 'Recovery: easy walk + mobility', duration: '30–45 min walk + 10 min mobility', intensity: 'Zone 1 · under ' + Math.round(maxHr * .6) + ' bpm', why: [battery != null && battery < 25 ? `Body Battery is ${Math.round(battery)}/100 — below the 25 recovery threshold.` : `You've trained ${f.consecutiveDays} days in a row.`, sleepText, 'Easy movement keeps fat-burning volume up while muscle repair catches up.'], lowEnergy: '10 min of gentle stretching or a slow 15 min walk.' };
  }
  const recovery = computeGarminRecovery(activities, daily, now);
  const ranked = [...recovery.cards].sort((a,b) => b.recovered - a.recovered || a.fatigue - b.fatigue);
  const fresh = ranked.filter(c => c.status === 'Fresh');
  const due = f.daysSinceStrength !== null && f.daysSinceStrength >= 2;
  const capped = cardioLeadStreak(history, today) >= 2;
  if (due || fresh.length || capped) {
    const muscles = (fresh.length ? fresh : ranked).slice(0,3).map(c => c.muscle);
    const upper = new Set(['chest','back','shoulders','arms','core']);
    const region = muscles.every(m => upper.has(m)) ? 'upper body' : muscles.every(m => !upper.has(m)) ? 'lower body' : 'most recovered muscles';
    const why = [due ? `It's been ${f.daysSinceStrength} days since your last strength session — strength leads.` : `${fresh.length} muscle group${fresh.length === 1 ? ' is' : 's are'} fresh — strength leads.`,
      `Most recovered: ${(fresh.length ? fresh : ranked).slice(0,3).map(c => `${c.muscle} ${c.recovered}%`).join(', ')}.`, batteryText];
    if (capped) why.push('Two consecutive cardio-lead days already logged — no third cardio lead.');
    return { rulesVersion: 'v2', ruleId: due ? 'strength_due' : fresh.length ? (region === 'upper body' ? 'fresh_upper_strength' : region === 'lower body' ? 'fresh_lower_strength' : 'fresh_muscle_strength') : 'cardio_lead_cap_strength', type: 'strength', title: `Strength: ${region}`, duration: '40–45 min', intensity: fresh.length ? 'Moderate–hard · RPE 7–8' : 'Light–moderate · adjust to soreness', why, lowEnergy: 'A shortened 20–25 min session with lighter weights.', muscleGroups: muscles, ...(budget.behind ? { finisher: '+15-20 min Zone 2 after lifting' } : {}) };
  }
  const yesterday = f.daysSinceStrength === 1;
  const farBehind = budget.farBehind && (f.daysSinceCardio === null || f.daysSinceCardio >= 2);
  const blocked = `${recovery.summary}. No muscle group is fresh (85% recovered). Strength ${f.daysSinceStrength === 0 ? 'was today' : yesterday ? 'was yesterday' : 'is not yet due'}.`;
  if (yesterday || farBehind) {
    const [lo,hi] = zoneRange(maxHr,2);
    return { rulesVersion: 'v2', ruleId: yesterday ? 'strength_yesterday_cardio' : 'cardio_far_behind_pace', type: 'cardio', title: 'Zone 2 cardio', duration: '30–40 min', intensity: `Zone 2 · ${lo}–${hi} bpm`, why: [yesterday ? 'Strength was yesterday and no muscle group is fresh yet.' : `Cardio ${Math.round(budget.actual)} min is below half of the ${budget.pace.toFixed(1)} min pace budget; last cardio ${f.daysSinceCardio ?? 'not recorded'} days ago.`, batteryText], strengthBlockedReason: blocked, lowEnergy: '20 min easy walk or gentle cycling.' };
  }
  return { rulesVersion: 'v2', ruleId: 'muscle_recovery_wait', type: 'recovery', title: 'Recovery: mobility', duration: '15–20 min', intensity: 'Gentle · comfortable effort', why: [blocked, 'Cardio does not meet either lead condition; allow recovery before another primary session.', batteryText], lowEnergy: 'Rest or gentle stretching.' };
}

// ---- Strength volume & progressive overload ----
export function weeklyVolume(strengthSets: StrengthSet[], activities: Workout[], today: string, weeks: number) {
  const dateByActivity = new Map(activities.map((a) => [a.activity_id, a.start_time_local?.slice(0, 10) ?? null]));
  const rows = new Map<string, Record<MuscleGroup, number>>();
  const first = shiftDate(weekStart(today), -7 * (weeks - 1));
  for (const s of strengthSets) {
    const date = dateByActivity.get(s.activity_id);
    if (!date || date < first || date > today) continue;
    const week = weekStart(date);
    const m = s.muscle_group as MuscleGroup;
    if (!MUSCLE_GROUPS.includes(m)) continue;
    const row = rows.get(week) ?? ({} as Record<MuscleGroup, number>);
    row[m] = (row[m] ?? 0) + (s.reps ?? 0) * (s.weight ?? 0);
    rows.set(week, row);
  }
  return [...rows.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, groups]) => ({ date, groups }));
}
export function progressiveOverload(strengthSets: StrengthSet[], activities: Workout[], today: string): string[] {
  const dateByActivity = new Map(activities.map((a) => [a.activity_id, a.start_time_local?.slice(0, 10) ?? null]));
  const byExercise = new Map<string, { date: string; weight: number }[]>();
  for (const s of strengthSets) {
    const date = dateByActivity.get(s.activity_id);
    if (!date || s.weight == null || date > today) continue;
    const list = byExercise.get(s.exercise) ?? [];
    list.push({ date, weight: s.weight });
    byExercise.set(s.exercise, list);
  }
  const notes: string[] = [];
  for (const [exercise, entries] of byExercise) {
    if (entries.length < 2) continue;
    entries.sort((a, b) => a.date.localeCompare(b.date));
    const last = entries.at(-1) as { date: string; weight: number };
    const prevSessions = [...new Set(entries.map((e) => e.date))].filter((d) => d < last.date);
    const prev = entries.filter((e) => e.date === prevSessions.at(-1)).reduce((mx, e) => Math.max(mx, e.weight), 0);
    if (prev > 0 && last.weight > prev) notes.push(`${exercise}: +${(last.weight - prev).toFixed(1)} weight vs last time (${prev} → ${last.weight}).`);
  }
  return notes.slice(0, 4);
}

// ---- Insights feed ----
export type Insight = { title: string; text: string; tone: 'up' | 'down' | 'neutral' };
export function goalInsights(daily: Daily[], activities: Workout[], weightLog: WeightEntry[], strengthSets: StrengthSet[], goals: Goals | null, today: string): { insights: Insight[]; recommendation: string } {
  const recentStart = shiftDate(today, -6);
  const prevStart = shiftDate(today, -13);
  const dayOf = (a: Workout) => a.start_time_local?.slice(0, 10) ?? null;
  const inRange = (from: string, to: string) => activities.filter((a) => dayOf(a) !== null && (dayOf(a) as string) >= from && (dayOf(a) as string) <= to);
  const r = inRange(recentStart, today);
  const p = inRange(prevStart, shiftDate(today, -7));

  const activeKcal = (list: Workout[]) => list.reduce((s, a) => s + (a.calories ?? 0), 0);
  const recentDays = daily.filter((d) => d.date >= recentStart && d.date <= today);
  const prevDays = daily.filter((d) => d.date >= prevStart && d.date < recentStart);
  const trend = (a: number | null, b: number | null) => (a === null || b === null ? 'neutral' : a > b ? 'up' : a < b ? 'down' : 'neutral');
  const cmp = (label: string, now: number | null, before: number | null, unit: string, noun: string) => {
    const tone = trend(now, before);
    const text = now === null || before === null
      ? `Not enough recorded readings to compare these two weeks for ${noun}.`
      : `${noun} ${now === before ? 'held at' : now > before ? 'rose to' : 'fell to'} ${Math.round(now).toLocaleString()}${unit}, versus ${Math.round(before).toLocaleString()}${unit} the previous week.`;
    return { title: label, text, tone } as Insight;
  };
  const insights: Insight[] = [];

  insights.push({
    title: 'Training rhythm',
    text: `${r.length} workouts in the last 7 days, ${r.length === p.length ? 'unchanged from' : r.length > p.length ? 'up from' : 'down from'} ${p.length} the previous week. Goal: steady sessions you can repeat.`,
    tone: trend(r.length, p.length),
  });

  // Personal bests in the last 4 weeks
  const winStart = shiftDate(today, -27);
  const runs = activities.filter((a) => dayOf(a) !== null && ['running', 'treadmill_running'].includes(workoutType(a.type)) && (a.distance_meters ?? 0) > 0);
  const bestIn = (list: Workout[]) => list.reduce((m, a) => Math.max(m, a.distance_meters ?? 0), 0);
  const bestRunNow = bestIn(runs.filter((a) => (dayOf(a) as string) >= winStart));
  const bestRunBefore = bestIn(runs.filter((a) => (dayOf(a) as string) < winStart));
  if (bestRunNow > 0 && bestRunNow > bestRunBefore) {
    insights.push({
      title: 'Personal best: run',
      text: `Longest run so far: ${(bestRunNow / 1000).toFixed(2)} km${bestRunBefore > 0 ? ` — up from ${(bestRunBefore / 1000).toFixed(2)} km` : ''}.`,
      tone: 'up',
    });
  }
  const dateByActivity = new Map(activities.map((a) => [a.activity_id, dayOf(a)]));
  const weightByExercise = new Map<string, { date: string; weight: number }[]>();
  for (const s of strengthSets) {
    const date = dateByActivity.get(s.activity_id);
    if (!date || s.weight == null || s.weight <= 0) continue;
    const list = weightByExercise.get(s.exercise) ?? [];
    list.push({ date, weight: s.weight });
    weightByExercise.set(s.exercise, list);
  }
  let liftPr: { exercise: string; now: number; before: number } | null = null;
  for (const [exercise, entries] of weightByExercise) {
    const now = entries.filter((e) => e.date >= winStart && e.date <= today).reduce((m, e) => Math.max(m, e.weight), 0);
    const before = entries.filter((e) => e.date < winStart).reduce((m, e) => Math.max(m, e.weight), 0);
    if (now > before && before > 0 && now - before > (liftPr ? liftPr.now - liftPr.before : 0)) liftPr = { exercise, now, before };
  }
  if (liftPr) {
    insights.push({
      title: 'Personal best: lift',
      text: `Heaviest ${liftPr.exercise} so far: ${liftPr.now} (up from ${liftPr.before}).`,
      tone: 'up',
    });
  }
  const budget = cardioBudget(activities, goals, today);
  insights.push({ title: 'Weekly cardio (last 7 days)', text: `${budget.label}. Previous 7 days: ${Math.round(cardioMinutes(activities, prevStart, shiftDate(today, -7)))} min. Pace budget: ${budget.pace.toFixed(1)} min (${budget.daysElapsed}/7 days elapsed this week).`, tone: 'neutral' });
  insights.push(cmp('Active calories', activeKcal(r), activeKcal(p), ' kcal', 'Active calories burned'));
  insights.push(cmp('Daily movement', average(recentDays.map((d) => d.steps)), average(prevDays.map((d) => d.steps)), ' steps', 'Average steps'));
  insights.push(cmp('Recharge signal', average(recentDays.map((d) => d.body_battery_high)), average(prevDays.map((d) => d.body_battery_high)), '/100', 'Average Body Battery high'));
  insights.push(cmp('Stress load', average(recentDays.map((d) => (d.stress_avg != null && d.stress_avg >= 0 ? d.stress_avg : null))), average(prevDays.map((d) => (d.stress_avg != null && d.stress_avg >= 0 ? d.stress_avg : null))), '', 'Average stress'));

  // Weight trend
  const weights = weightLog.filter((w) => w.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const firstW = weights.find((w) => w.date >= prevStart);
  const lastW = weights.at(-1);
  const target = goals?.target_weight ?? null;
  const units = goals?.units ?? 'kg';
  if (lastW && firstW && lastW.date !== firstW.date) {
    const delta = lastW.weight - firstW.weight;
    const toGo = target != null ? lastW.weight - target : null;
    insights.push({
      title: 'Weight trend',
      text: `Weight ${delta === 0 ? 'held at' : delta < 0 ? 'down to' : 'up to'} ${lastW.weight} ${units} from ${firstW.weight} ${units} over the last two weeks.${toGo != null ? toGo > 0 ? ` ${toGo.toFixed(1)} ${units} to your target of ${target} ${units}.` : ` You're at or past your target of ${target} ${units}.` : ''}`,
      tone: target != null ? (delta < 0 ? 'up' : delta > 0 ? 'down' : 'neutral') : trend(lastW.weight, firstW.weight),
    });
  } else if (lastW) {
    insights.push({ title: 'Weight trend', text: `Latest logged weight: ${lastW.weight} ${units} on ${lastW.date}. Log it regularly to see a trend.${target != null ? ` Target: ${target} ${units}.` : ''}`, tone: 'neutral' });
  } else {
    insights.push({ title: 'Weight trend', text: 'No weight logged yet. Add one on the Goals page to track progress toward your target.', tone: 'neutral' });
  }

  // Strength volume
  const volume = (from: string, to: string) => strengthSets.filter((s) => { const d = activities.find((a) => a.activity_id === s.activity_id)?.start_time_local?.slice(0, 10); return d != null && d >= from && d <= to; }).reduce((sum, s) => sum + (s.reps ?? 0) * (s.weight ?? 0), 0);
  const vNow = volume(recentStart, today), vBefore = volume(prevStart, shiftDate(today, -7));
  if (vNow > 0 || vBefore > 0) {
    insights.push({
      title: 'Strength volume',
      text: vNow === vBefore ? `Training volume held at ${Math.round(vNow).toLocaleString()} total this week.` : `Training volume ${vNow > vBefore ? 'rose to' : 'fell to'} ${Math.round(vNow).toLocaleString()} versus ${Math.round(vBefore).toLocaleString()} the previous week.`,
      tone: trend(vNow, vBefore),
    });
  }

  const next = nextWorkout(daily, activities, goals, strengthSets, today);
  const recommendation = `${next.title}. ${next.why[0]}${next.finisher ? ` Optional: ${next.finisher}.` : ''}`;

  return { insights: insights.slice(0, 9), recommendation };
}

// ---- Goal-fit note for a workout detail page ----
export function goalNote(a: Workout, daily: Daily[], maxHr: number): string {
  const t = workoutType(a.type);
  if (t === 'strength_training') return 'Strength training builds the muscle side of your goal — each session adds stimulus for growth and raises your resting metabolism.';
  const zones = timeInZones(a);
  const z23 = zones.filter((z) => z.zone === 2 || z.zone === 3).reduce((s, z) => s + z.minutes, 0);
  const z45 = zones.filter((z) => z.zone >= 4).reduce((s, z) => s + z.minutes, 0);
  if (z23 >= 10) return `${Math.round(z23)} min in zones 2–3 (under ${Math.round(maxHr * 0.8)} bpm) — this is fat-burning cardio that builds your aerobic base without heavy recovery cost.`;
  if (z45 >= 10) return `${Math.round(z45)} min in zones 4–5 — high-intensity work burns calories fast and lifts fitness, but plan an easier day after it.`;
  return 'Any movement adds to your daily calorie burn and supports your weight-loss goal — keep showing up.';
}

export function weightSeries(weightLog: WeightEntry[], goals: Goals | null, today: string, days: number) {
  const from = shiftDate(today, -days);
  return weightLog.filter((w) => w.date >= from && w.date <= today).sort((a, b) => a.date.localeCompare(b.date)).map((w) => ({ date: w.date, weight: w.weight }));
}
