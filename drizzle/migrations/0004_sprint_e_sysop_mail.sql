CREATE TABLE public.sysop_mail (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, caller_id uuid NOT NULL, rule_key text NOT NULL, board text NOT NULL, subject text NOT NULL, body text NOT NULL, occurred_call integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), delivered_call integer, delivered_at timestamptz, read_at timestamptz, UNIQUE(caller_id,rule_key));
GRANT ALL ON public.sysop_mail TO service_role;
ALTER TABLE public.sysop_mail ENABLE ROW LEVEL SECURITY;
CREATE INDEX sysop_mail_caller ON public.sysop_mail(caller_id,id);
CREATE OR REPLACE FUNCTION public.deliver_sysop_mail(_caller uuid,_call integer) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE delivered integer;
BEGIN
 PERFORM id FROM callers WHERE id=_caller FOR UPDATE;
 SELECT count(*) INTO delivered FROM sysop_mail WHERE caller_id=_caller AND delivered_call=_call;
 UPDATE sysop_mail SET delivered_call=_call,delivered_at=now() WHERE id IN (SELECT id FROM sysop_mail WHERE caller_id=_caller AND delivered_call IS NULL AND occurred_call<_call ORDER BY id LIMIT GREATEST(0,2-delivered));
 RETURN (SELECT count(*) FROM sysop_mail WHERE caller_id=_caller AND delivered_call=_call);
END $$;
REVOKE ALL ON FUNCTION public.deliver_sysop_mail(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.deliver_sysop_mail(uuid,integer) TO service_role;
ALTER TABLE public.corner_runs ADD COLUMN IF NOT EXISTS finished_at timestamptz;
UPDATE public.corner_runs SET finished_at=day::timestamp AT TIME ZONE 'UTC' WHERE score IS NOT NULL AND finished_at IS NULL;