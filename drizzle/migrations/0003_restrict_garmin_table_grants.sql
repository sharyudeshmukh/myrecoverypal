REVOKE ALL ON public.garmin_daily FROM anon, authenticated;
GRANT SELECT ON public.garmin_daily TO authenticated;
GRANT ALL ON public.garmin_daily TO service_role;
REVOKE ALL ON public.garmin_activities FROM anon, authenticated;
GRANT SELECT ON public.garmin_activities TO authenticated;
GRANT ALL ON public.garmin_activities TO service_role;