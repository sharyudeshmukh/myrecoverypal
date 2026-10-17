CREATE TABLE public.garmin_daily (
  date date PRIMARY KEY,
  sleep_score numeric,
  sleep_seconds numeric,
  deep_sleep_seconds numeric,
  rem_sleep_seconds numeric,
  light_sleep_seconds numeric,
  awake_seconds numeric,
  resting_hr numeric,
  hrv_last_night_avg numeric,
  hrv_weekly_avg numeric,
  training_readiness numeric,
  stress_avg numeric,
  stress_max numeric,
  body_battery_high numeric,
  body_battery_low numeric,
  body_battery_charged numeric,
  body_battery_drained numeric,
  body_battery_wake numeric,
  steps numeric,
  active_kcal numeric,
  intensity_minutes numeric,
  hrv_status text,
  training_readiness_level text,
  raw jsonb
);
GRANT SELECT ON public.garmin_daily TO authenticated;
GRANT ALL ON public.garmin_daily TO service_role;
ALTER TABLE public.garmin_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads Garmin daily" ON public.garmin_daily FOR SELECT TO authenticated USING (auth.uid() = '4c0524d5-9621-4a12-92b1-8320d8ab5622'::uuid);

CREATE TABLE public.garmin_activities (
  activity_id bigint PRIMARY KEY,
  name text,
  type text,
  start_time_local timestamp without time zone,
  duration_seconds numeric,
  distance_meters numeric,
  avg_hr numeric,
  max_hr numeric,
  calories numeric,
  aerobic_te numeric,
  anaerobic_te numeric,
  training_load numeric,
  avg_pace_or_speed numeric,
  elevation_gain numeric,
  raw jsonb
);
GRANT SELECT ON public.garmin_activities TO authenticated;
GRANT ALL ON public.garmin_activities TO service_role;
ALTER TABLE public.garmin_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads Garmin activities" ON public.garmin_activities FOR SELECT TO authenticated USING (auth.uid() = '4c0524d5-9621-4a12-92b1-8320d8ab5622'::uuid);