import { z } from "zod";

const numeric = z.number().finite().nullable().optional();
const text = z.string().max(1000).nullable().optional();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Invalid calendar date");
const dailySchema = z.object({
  date,
  sleep_score: numeric, sleep_seconds: numeric, deep_sleep_seconds: numeric,
  rem_sleep_seconds: numeric, light_sleep_seconds: numeric, awake_seconds: numeric,
  resting_hr: numeric, hrv_last_night_avg: numeric, hrv_weekly_avg: numeric,
  training_readiness: numeric, stress_avg: numeric, stress_max: numeric,
  body_battery_high: numeric, body_battery_low: numeric, body_battery_charged: numeric,
  body_battery_drained: numeric, body_battery_wake: numeric, steps: numeric,
  active_kcal: numeric, intensity_minutes: numeric, hrv_status: text,
  training_readiness_level: text, raw: z.unknown().optional(),
}).strict();
const activityId = z.union([z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), z.string().regex(/^\d{1,19}$/)])
  .refine(value => BigInt(value) <= 9223372036854775807n, "Activity ID exceeds bigint range");
const activitySchema = z.object({
  activity_id: activityId, name: text, type: text,
  start_time_local: z.string().regex(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?$/)
    .refine(value => date.safeParse(value.slice(0, 10)).success && Number.isFinite(Date.parse(value.replace(" ", "T") + "Z")), "Invalid local timestamp").nullable().optional(),
  duration_seconds: numeric, distance_meters: numeric, avg_hr: numeric, max_hr: numeric,
  calories: numeric, aerobic_te: numeric, anaerobic_te: numeric, training_load: numeric,
  avg_pace_or_speed: numeric, elevation_gain: numeric, raw: z.unknown().optional(),
}).strict();
export const garminPayloadSchema = z.object({
  days: z.array(dailySchema).max(10000),
  activities: z.array(activitySchema).max(10000),
}).strict();
export type GarminPayload = z.infer<typeof garminPayloadSchema>;

export async function matchesIngestToken(provided: string | null, expected: string): Promise<boolean> {
  if (!provided) return false;
  const encode = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encode.encode(provided)),
    crypto.subtle.digest("SHA-256", encode.encode(expected)),
  ]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return difference === 0;
}

export async function handleGarminIngest(request: Request, secret: string | undefined,
  save: (payload: GarminPayload) => Promise<{ days: number; activities: number }>) {
  if (!secret) return Response.json({ error: "Ingestion is not configured." }, { status: 503 });
  if (!await matchesIngestToken(request.headers.get("x-ingest-token"), secret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = garminPayloadSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid Garmin payload", issues: parsed.error.issues.map(issue => ({ path: issue.path, message: issue.message })) }, { status: 400 });
  try {
    return Response.json(await save(parsed.data));
  } catch {
    return Response.json({ error: "Unable to save Garmin data. Retry the same payload safely." }, { status: 500 });
  }
}