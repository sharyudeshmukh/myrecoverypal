import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/integrations/supabase/types';
import type { RecommendationLog } from './evaluation';
import { freezeRecommendation, replayHistory } from './evaluation';

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
  const pending = replay ? replayHistory(data.daily, data.activities, data.goals, data.sets, userId, today) : [];
  pending.push(freezeRecommendation(data.daily, data.activities, data.goals, data.sets, today, userId, 'live'));
  // INSERT ... ON CONFLICT DO NOTHING is atomic, including concurrent sync/page loads.
  for (let i = 0; i < pending.length; i += 10) {
    const rows = pending.slice(i,i+10).map(r => ({ ...r, recommendation: JSON.parse(JSON.stringify(r.recommendation)) as Json }));
    const saved = await writer.from('recommendation_log').upsert(rows, { onConflict: 'user_id,for_date', ignoreDuplicates: true });
    if (saved.error) throw new Error('Recommendation could not be frozen.');
  }
  const logs = await reader.from('recommendation_log').select('*').eq('user_id', userId).order('for_date').limit(1000);
  if (logs.error || logs.data.length === 1000) throw new Error('Recommendation history could not be loaded completely.');
  return { data, logs: logs.data.map(r => ({ ...r, recommendation: r.recommendation as unknown as RecommendationLog['recommendation'] })) };
}