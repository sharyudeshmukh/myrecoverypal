import { shiftDate, workoutType, type Daily, type Workout } from './fitness-dashboard';
import { freezeRecommendation, seededRandom, type RecommendationLog } from './evaluation';
import type { Goals, StrengthSet } from './goals';

// Simulated frozen advice, not claimed to be outputs of the historical/current engine.
// Advice is selected to create ~70% adherence without changing actual workouts.
export function generateDemoEvaluation(daily: Daily[], activities: Workout[], goals: Goals, sets: StrengthSet[], today: string): RecommendationLog[] {
  const rand = seededRandom(7781);
  return daily.map((d,i) => {
    const date = d.date;
    const actual = activities.filter(a=>a.start_time_local?.slice(0,10) === date);
    const type = actual.some(a=>workoutType(a.type)==='strength_training') ? 'strength' : actual.length ? 'cardio' : 'recovery';
    const followed = i % 10 < 7;
    const recType = followed ? type : type === 'strength' ? 'cardio' : type === 'cardio' ? 'strength' : 'cardio';
    const base = freezeRecommendation(daily, activities, goals, sets, date, goals.user_id, 'replay', `${date}T08:00:00Z`);
    const duration = !followed && actual.length && i%3 === 0 ? (actual[0]?.duration_seconds ?? 2400)/60/.5 : recType === 'strength' ? 40 : 30;
    if (!followed && actual.length && i%3 === 0) base.rec_type = type;
    else base.rec_type = recType;
    base.duration_min = duration;
    base.rule_id = base.rec_type === 'recovery' ? 'low_bb_recovery' : base.rec_type === 'strength' ? 'strength_due' : i%2 ? 'strength_yesterday_cardio' : 'cardio_behind_target';
    base.source = i < 30 ? 'replay' : 'live';
    base.rules_version = i < 60 ? 'v1' : 'v2';
    base.inputs = { goals: { strength_target: 3, cardio_minutes_target: 150 }, synthetic: true, engine_version: 'synthetic-showcase-v1' };
    base.recommendation = { ...base.recommendation, type:base.rec_type, ruleId:base.rule_id };
    const next = daily.find(x=>x.date === shiftDate(date,1));
    if (next && next.date !== today) {
      // Small simulated benefit + substantial noise: overlapping outcome distributions.
      next.body_battery_wake = Math.round(72 + (followed ? 1 : 0) + (rand()-.5)*40);
      next.body_battery_high = Math.max(next.body_battery_wake, next.body_battery_high ?? 0);
    }
    return base;
  });
}