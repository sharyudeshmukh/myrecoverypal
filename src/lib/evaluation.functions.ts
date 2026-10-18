import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { captureRecommendations } from './evaluation.server';
export const fetchEvaluation = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  // RLS reader establishes eligibility; privileged writer is only for immutable server-produced snapshots.
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const today = new Date().toISOString().slice(0,10);
  const result = await captureRecommendations(context.supabase, supabaseAdmin, context.userId, today, true);
  return { logs: result.logs, daily: result.data.daily, activities: result.data.activities, goals: result.data.goals, today };
});