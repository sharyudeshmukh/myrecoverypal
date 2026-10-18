CREATE TABLE public.recommendation_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
 for_date date NOT NULL, generated_at timestamptz NOT NULL DEFAULT now(),
 rec_type text NOT NULL CHECK (rec_type IN ('strength','cardio','recovery')),
 target_muscles text[] NOT NULL DEFAULT '{}', duration_min numeric NOT NULL,
 hr_low numeric, hr_high numeric, rule_id text NOT NULL,
 inputs jsonb NOT NULL, recommendation jsonb NOT NULL,
 source text NOT NULL CHECK (source IN ('live','replay')),
 UNIQUE(user_id,for_date)
);
GRANT SELECT, INSERT ON public.recommendation_log TO authenticated;
GRANT ALL ON public.recommendation_log TO service_role;
ALTER TABLE public.recommendation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own recommendations" ON public.recommendation_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Insert own recommendations" ON public.recommendation_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE FUNCTION public.freeze_recommendation_log() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN RAISE EXCEPTION 'Recommendation snapshots are immutable'; END; $$;
CREATE TRIGGER freeze_recommendation_log BEFORE UPDATE OR DELETE ON public.recommendation_log FOR EACH ROW EXECUTE FUNCTION public.freeze_recommendation_log();
COMMENT ON TABLE public.recommendation_log IS 'Immutable first recommendation per user and date. Adherence and outcomes are derived from current Garmin records; replay is current-engine simulation, not historical advice.';