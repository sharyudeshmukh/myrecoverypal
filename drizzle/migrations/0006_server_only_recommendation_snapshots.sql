REVOKE INSERT ON public.recommendation_log FROM authenticated;
DROP POLICY "Insert own recommendations" ON public.recommendation_log;
COMMENT ON TABLE public.recommendation_log IS 'Owner SELECT only. Trusted server writes immutable snapshots. Adherence and outcomes derived, replay kept separate.';