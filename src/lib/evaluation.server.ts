import { pacificHour } from './fitness-dashboard';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/integrations/supabase/types';
import type { RecommendationLog } from './evaluation';
import { freezeRecommendation } from './evaluation';

export async function readEvaluationData(client: SupabaseClient<Database>, userId: string) {
  const [daily, activities, goals, sets] = await Promise.all([
    client.from('garmin_daily').select('*').order('date').limit(1000),
    client.from('garmin_activities').select('*').order('start_time_local').limit(10000),
    client.from('user_goals').select('*').eq('user_id', userId).maybeSingle(),
    client.from('strength_sets').select('*').eq('user_id', userId).limit(10000),
  ]);
  if (daily.error || activities.error || goals.error || sets.error) throw new Error('Evaluation history could not be loaded.');
  if (daily.data.length === 1000 || activities.data.length === 10000 || sets.data.length === 10000) throw new Error('History exceeds evaluation limits; incomplete analysis was not produced.');
  return { daily: daily.data, activities: activities.data, goals: goals.data, sets: sets.data };
}

export async function captureRecommendations(reader: SupabaseClient<Database>, writer: SupabaseClient<Database>, userId: string, today: string, replay: boolean) {
  const data = await readEvaluationData(reader, userId);
  // No Garmin read permission / no readings: never fabricate a live recommendation.
  if (!data.daily.length) return { data, logs: [] as RecommendationLog[] };
  const existing = await reader.from('recommendation_log').select('for_date,rec_type').eq('user_id',userId).order('for_date').limit(1000);
  if (existing.error || existing.data.length === 1000) throw new Error('Frozen recommendation dates could not be loaded.');
  const dates = new Set(existing.data.map(r=>r.for_date));
  const history = existing.data.map(r => {
    if (!['strength','cardio','recovery'].includes(r.rec_type)) throw new Error('Invalid recommendation history.');
    return { for_date: r.for_date, rec_type: r.rec_type as RecommendationLog['rec_type'] };
  });
  const missing = replay ? data.daily.filter(d=>d.date < today && !dates.has(d.date)).sort((a,b)=>a.date.localeCompare(b.date)) : [];
  const snapshots: RecommendationLog[] = [];
  for (const r of missing) {
    const snapshot = freezeRecommendation(data.daily,data.activities,data.goals,data.sets,r.date,userId,'replay',undefined,history);
    snapshots.push(snapshot);
    history.push(snapshot);
  }
  // Freeze today's advice only after the morning sync (overnight sleep present) or late morning Pacific, never the night before.
  const todayRow = data.daily.find(d => d.date === today);
  const morningReady = todayRow?.sleep_seconds != null || pacificHour() >= 11;
  if (!dates.has(today) && morningReady) snapshots.push(freezeRecommendation(data.daily, data.activities, data.goals, data.sets, today, userId, 'live',undefined,history));
  // INSERT ... ON CONFLICT DO NOTHING is atomic, including concurrent sync/page loads.
  for (let i = 0; i < snapshots.length; i += 10) {
    const rows = snapshots.slice(i,i+10).map(r => ({ ...r, recommendation: JSON.parse(JSON.stringify(r.recommendation)) as Json }));
    const saved = await writer.from('recommendation_log').upsert(rows, { onConflict: 'user_id,for_date', ignoreDuplicates: true });
    if (saved.error) throw new Error('Recommendation could not be frozen.');
  }
  const logs = await reader.from('recommendation_log').select('*').eq('user_id', userId).order('for_date').limit(1000);
  if (logs.error || logs.data.length === 1000) throw new Error('Recommendation history could not be loaded completely.');
  return { data, logs: logs.data.map(r => {
    if (!['strength','cardio','recovery'].includes(r.rec_type) || !['live','replay'].includes(r.source)) throw new Error('Invalid frozen recommendation.');
    if (!['v1','v2','v3'].includes(r.rules_version)) throw new Error('Invalid rules version.');
    return { ...r, rules_version: r.rules_version as RecommendationLog['rules_version'], rec_type: r.rec_type as RecommendationLog['rec_type'], source: r.source as RecommendationLog['source'], recommendation: r.recommendation as unknown as RecommendationLog['recommendation'] };
  }) };
}