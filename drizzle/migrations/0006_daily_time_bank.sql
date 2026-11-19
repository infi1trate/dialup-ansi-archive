CREATE TABLE public.time_accounts(caller_id uuid PRIMARY KEY,day date NOT NULL,allowance_seconds integer NOT NULL DEFAULT 1800,used_seconds integer NOT NULL DEFAULT 0,bank_seconds integer NOT NULL DEFAULT 0,withdrawn_seconds integer NOT NULL DEFAULT 0);
GRANT ALL ON public.time_accounts TO service_role;
ALTER TABLE public.time_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_sessions ADD COLUMN IF NOT EXISTS exempt boolean NOT NULL DEFAULT false;
ALTER TABLE public.call_log ADD COLUMN IF NOT EXISTS board text NOT NULL DEFAULT 'crawl';
ALTER TABLE public.call_log ADD COLUMN IF NOT EXISTS session_id uuid;
CREATE TABLE public.device_calls(token_hash text PRIMARY KEY,calls integer NOT NULL DEFAULT 0);
GRANT ALL ON public.device_calls TO service_role;
ALTER TABLE public.device_calls ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.first_device_call(_hash text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE n integer; BEGIN INSERT INTO device_calls(token_hash,calls) VALUES(_hash,1) ON CONFLICT(token_hash) DO UPDATE SET calls=device_calls.calls+1 RETURNING calls INTO n;RETURN n=1; END $$;
REVOKE ALL ON FUNCTION public.first_device_call(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.first_device_call(text) TO service_role;
CREATE OR REPLACE FUNCTION public.time_bank(_caller uuid,_allowance integer,_now timestamptz,_session uuid DEFAULT NULL,_withdraw integer DEFAULT 0,_active boolean DEFAULT true,_close boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE acc time_accounts%ROWTYPE; ses call_sessions%ROWTYPE; d date:=(_now AT TIME ZONE 'UTC')::date; delta integer:=0; prev integer:=0; days integer;
BEGIN
 PERFORM id FROM callers WHERE id=_caller FOR UPDATE;
 INSERT INTO time_accounts(caller_id,day,allowance_seconds) VALUES(_caller,d,_allowance) ON CONFLICT DO NOTHING;
 SELECT * INTO acc FROM time_accounts WHERE caller_id=_caller FOR UPDATE;
 IF _session IS NOT NULL THEN SELECT * INTO ses FROM call_sessions WHERE id=_session AND caller_id=_caller FOR UPDATE;
  IF FOUND AND NOT ses.closed THEN
   delta:=CASE WHEN _active THEN GREATEST(0,LEAST(75,FLOOR(EXTRACT(EPOCH FROM _now-ses.charged_at))::integer)) ELSE 0 END;
   IF ses.charged_at<d::timestamp AT TIME ZONE 'UTC' THEN prev:=LEAST(delta,GREATEST(0,FLOOR(EXTRACT(EPOCH FROM (d::timestamp AT TIME ZONE 'UTC')-ses.charged_at))::integer));END IF;
   UPDATE call_sessions SET used_seconds=used_seconds+delta,charged_at=_now,closed=_close WHERE id=ses.id;
   IF NOT ses.exempt AND acc.day<d THEN acc.used_seconds:=acc.used_seconds+prev;END IF;
  END IF;
 END IF;
 IF acc.day<d THEN days:=d-acc.day;acc.bank_seconds:=LEAST(7200,acc.bank_seconds+GREATEST(0,acc.allowance_seconds+acc.withdrawn_seconds-acc.used_seconds)+GREATEST(0,days-1)*_allowance);acc.day:=d;acc.used_seconds:=0;acc.withdrawn_seconds:=0;END IF;
 acc.allowance_seconds:=_allowance;
 IF _session IS NOT NULL AND NOT COALESCE(ses.exempt,false) THEN acc.used_seconds:=acc.used_seconds+delta-prev;END IF;
 IF _withdraw<>0 THEN IF _withdraw<>900 OR acc.bank_seconds<900 THEN RAISE EXCEPTION 'Withdraw 15 available minutes at a time';END IF;acc.bank_seconds:=acc.bank_seconds-900;acc.withdrawn_seconds:=acc.withdrawn_seconds+900;END IF;
 UPDATE time_accounts SET day=acc.day,allowance_seconds=acc.allowance_seconds,used_seconds=acc.used_seconds,bank_seconds=acc.bank_seconds,withdrawn_seconds=acc.withdrawn_seconds WHERE caller_id=_caller;
 RETURN to_jsonb(acc)||jsonb_build_object('remainingSeconds',GREATEST(0,acc.allowance_seconds+acc.withdrawn_seconds-acc.used_seconds),'exempt',COALESCE(ses.exempt,false));
END $$;
REVOKE ALL ON FUNCTION public.time_bank(uuid,integer,timestamptz,uuid,integer,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.time_bank(uuid,integer,timestamptz,uuid,integer,boolean,boolean) TO service_role;