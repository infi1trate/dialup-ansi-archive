CREATE OR REPLACE FUNCTION public.second_call_rate()
RETURNS TABLE(created bigint, returned bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::bigint,
         count(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM public.call_log l
           WHERE l.caller_id = c.id AND (l.created_at AT TIME ZONE 'UTC')::date > (c.created_at AT TIME ZONE 'UTC')::date))::bigint
  FROM public.callers c;
$$;
REVOKE ALL ON FUNCTION public.second_call_rate() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.second_call_rate() TO service_role;