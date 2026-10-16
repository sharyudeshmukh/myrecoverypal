CREATE TABLE public.garmin_wellness (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 metric text NOT NULL,
 period text NOT NULL,
 date text NOT NULL,
 values jsonb NOT NULL,
 UNIQUE(user_id,metric,date)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.garmin_wellness TO authenticated;
GRANT ALL ON public.garmin_wellness TO service_role;
ALTER TABLE public.garmin_wellness ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own wellness" ON public.garmin_wellness FOR SELECT TO authenticated USING(auth.uid() = user_id);
CREATE POLICY "Insert own wellness" ON public.garmin_wellness FOR INSERT TO authenticated WITH CHECK(auth.uid() = user_id);
CREATE POLICY "Update own wellness" ON public.garmin_wellness FOR UPDATE TO authenticated USING(auth.uid() = user_id) WITH CHECK(auth.uid() = user_id);
CREATE POLICY "Delete own wellness" ON public.garmin_wellness FOR DELETE TO authenticated USING(auth.uid() = user_id);