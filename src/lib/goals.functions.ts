import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

const goalsSchema = z.object({
  goal: z.string().trim().min(1).max(120),
  current_weight: z.number().positive().max(500).nullable(),
  target_weight: z.number().positive().max(500).nullable(),
  units: z.enum(['kg', 'lb']),
  age: z.number().int().min(10).max(100).nullable(),
  max_hr: z.number().positive().max(250).nullable(),
  steps_goal: z.number().int().min(1000).max(100000),
  strength_target: z.number().int().min(0).max(14),
  cardio_minutes_target: z.number().int().min(0).max(2000),
});

export const saveGoals = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => goalsSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from('user_goals').upsert({ user_id: context.userId, ...data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) throw new Error('Your goals could not be saved. Please try again.');
    return { ok: true };
  });

const weightSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), weight: z.number().positive().max(500) });
export const logWeight = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => weightSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from('weight_log').upsert({ user_id: context.userId, ...data }, { onConflict: 'user_id,date' });
    if (error) throw new Error('Your weight could not be saved. Please try again.');
    return { ok: true };
  });
export const deleteWeight = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from('weight_log').delete().eq('id', data.id);
    if (error) throw new Error('That weight entry could not be removed.');
    return { ok: true };
  });

const setSchema = z.object({
  activity_id: z.number().int(),
  exercise: z.string().trim().min(1).max(80),
  muscle_group: z.string().trim().min(1).max(40),
  set_number: z.number().int().min(1).max(50),
  reps: z.number().int().min(0).max(500).nullable(),
  weight: z.number().min(0).max(1000).nullable(),
});
export const addStrengthSet = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => setSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from('strength_sets').insert({ user_id: context.userId, ...data });
    if (error) throw new Error('That set could not be saved. Please try again.');
    return { ok: true };
  });
export const deleteStrengthSet = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from('strength_sets').delete().eq('id', data.id);
    if (error) throw new Error('That set could not be removed.');
    return { ok: true };
  });

export const fetchWorkoutDetail = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ activityId: z.number().int() }).parse(data))
  .handler(async ({ context, data }) => {
    const [activity, previous, sets] = await Promise.all([
      context.supabase.from('garmin_activities').select('*').eq('activity_id', data.activityId).maybeSingle(),
      context.supabase.from('garmin_activities').select('*').neq('activity_id', data.activityId).order('start_time_local', { ascending: false }).limit(50),
      context.supabase.from('strength_sets').select('*').eq('activity_id', data.activityId).order('set_number'),
    ]);
    if (activity.error) throw new Error('This workout could not be loaded.');
    if (!activity.data) throw new Error('This workout was not found.');
    const a = activity.data;
    const sameType = (previous.data ?? []).filter((p) => (p.type ?? '') === (a.type ?? '') && p.start_time_local != null && a.start_time_local != null && p.start_time_local < a.start_time_local);
    return { activity: a, previous: sameType[0] ?? null, sets: sets.data ?? [] };
  });
