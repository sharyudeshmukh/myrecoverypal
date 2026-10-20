import { pacificToday } from '@/lib/fitness-dashboard';
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { captureRecommendations } from './evaluation.server';
export const fetchFitnessDashboard = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const [daily, activities, goals, weightLog, strengthSets, recoveryActivities] = await Promise.all([
    context.supabase.from('garmin_daily').select('*').order('date', { ascending: false }).limit(100),
    context.supabase.from('garmin_activities').select('activity_id,name,type,start_time_local,duration_seconds,distance_meters,avg_hr,max_hr,calories,aerobic_te,anaerobic_te,training_load,avg_pace_or_speed,elevation_gain').order('start_time_local', { ascending: false }).limit(10000),
    context.supabase.from('user_goals').select('*').eq('user_id', context.userId).maybeSingle(),
    context.supabase.from('weight_log').select('*').order('date', { ascending: false }).limit(500),
    context.supabase.from('strength_sets').select('*').order('created_at', { ascending: false }).limit(2000),
    context.supabase.from('garmin_activities').select('*').gte('start_time_local', new Date(Date.now() - 8 * 864e5).toISOString().slice(0, 10)).order('start_time_local', { ascending: false }).limit(10000),
  ]);
  if (daily.error) throw new Error('Daily readings could not be loaded. Please try again.');
  if (activities.error) throw new Error('Workouts could not be loaded. Please try again.');
  if (recoveryActivities.error) throw new Error('Recovery workouts could not be loaded. Please try again.');
  const rawById = new Map(recoveryActivities.data.map(a => [a.activity_id, a.raw]));
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const today = pacificToday();
  const evaluation = await captureRecommendations(context.supabase, supabaseAdmin, context.userId, today, false);
  return {
    recommendation: evaluation.logs.find(r => r.for_date === today && r.source === 'live')?.recommendation ?? null,
    daily: daily.data.map((d) => ({ ...d, raw: d.raw })),
    activities: activities.data.map((a) => ({ ...a, raw: rawById.get(a.activity_id) ?? null })),
    goals: goals.data ?? null,
    weightLog: weightLog.data ?? [],
    strengthSets: strengthSets.data ?? [],
    userId: context.userId,
  };
});
