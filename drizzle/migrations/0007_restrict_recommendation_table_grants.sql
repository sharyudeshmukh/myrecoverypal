REVOKE ALL ON public.recommendation_log FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.recommendation_log FROM authenticated;
GRANT SELECT ON public.recommendation_log TO authenticated;
GRANT ALL ON public.recommendation_log TO service_role;