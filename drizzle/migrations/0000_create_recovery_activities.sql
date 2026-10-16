CREATE TABLE public.recovery_activities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 source_key text,
 date text NOT NULL,
 type text NOT NULL,
 title text,
 muscles text[] NOT NULL DEFAULT '{}',
 intensity double precision,
 sleep double precision,
 soreness double precision,
 duration text,
 avg_hr integer,
 max_hr integer,
 calories double precision,
 distance double precision,
 source_data jsonb,
 UNIQUE(user_id, source_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recovery_activities TO authenticated;
GRANT ALL ON public.recovery_activities TO service_role;
ALTER TABLE public.recovery_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own activities" ON public.recovery_activities FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Insert own activities" ON public.recovery_activities FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own activities" ON public.recovery_activities FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own activities" ON public.recovery_activities FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX recovery_activities_user_date ON public.recovery_activities(user_id, date DESC);