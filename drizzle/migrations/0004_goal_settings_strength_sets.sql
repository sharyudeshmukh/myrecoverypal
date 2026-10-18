CREATE TABLE public.user_goals (
  user_id uuid PRIMARY KEY,
  goal text NOT NULL DEFAULT 'Lose weight + build muscle',
  current_weight numeric,
  target_weight numeric,
  units text NOT NULL DEFAULT 'kg',
  age integer,
  max_hr numeric,
  steps_goal integer NOT NULL DEFAULT 10000,
  strength_target integer NOT NULL DEFAULT 3,
  cardio_minutes_target integer NOT NULL DEFAULT 150,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_goals TO authenticated;
GRANT ALL ON public.user_goals TO service_role;
ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages goals" ON public.user_goals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.weight_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date text NOT NULL,
  weight numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX weight_log_user_date_idx ON public.weight_log (user_id, date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weight_log TO authenticated;
GRANT ALL ON public.weight_log TO service_role;
ALTER TABLE public.weight_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages weight log" ON public.weight_log FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.strength_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activity_id bigint NOT NULL,
  exercise text NOT NULL,
  muscle_group text NOT NULL,
  set_number integer NOT NULL,
  reps integer,
  weight numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX strength_sets_user_activity_idx ON public.strength_sets (user_id, activity_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strength_sets TO authenticated;
GRANT ALL ON public.strength_sets TO service_role;
ALTER TABLE public.strength_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages strength sets" ON public.strength_sets FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);