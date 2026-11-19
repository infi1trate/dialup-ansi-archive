CREATE TABLE public.caller_access (caller_id uuid PRIMARY KEY, level text NOT NULL DEFAULT 'NEW USER', announced_level text NOT NULL DEFAULT 'NEW USER', previous_call_at timestamptz, CHECK (level IN ('NEW USER','VALIDATED','ELITE')));
GRANT ALL ON public.caller_access TO service_role;
ALTER TABLE public.caller_access ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.call_sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), caller_id uuid NOT NULL, board text NOT NULL DEFAULT 'crawl', day date NOT NULL DEFAULT CURRENT_DATE, started_at timestamptz NOT NULL DEFAULT now(), charged_at timestamptz NOT NULL DEFAULT now(), used_seconds integer NOT NULL DEFAULT 0, closed boolean NOT NULL DEFAULT false);
GRANT ALL ON public.call_sessions TO service_role;
ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX call_sessions_caller_day ON public.call_sessions(caller_id,day);
CREATE TABLE public.wall_posts (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, caller_id uuid NOT NULL, handle text NOT NULL, body text NOT NULL, hidden boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.wall_posts TO service_role;
ALTER TABLE public.wall_posts ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.message_reports (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, caller_id uuid, kind text NOT NULL, message_id bigint NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), CHECK (kind IN ('wall','oneliner')));
GRANT ALL ON public.message_reports TO service_role;
ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.caller_record(_caller uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE days integer; pieces integer; lines integer; posts integer; ratings integer; runs integer; earned text; saved text; result jsonb;
BEGIN
 SELECT count(DISTINCT (created_at AT TIME ZONE 'UTC')::date) INTO days FROM call_log WHERE caller_id=_caller;
 SELECT count(*) INTO pieces FROM views WHERE viewer='c:'||_caller::text;
 SELECT count(*) INTO lines FROM oneliners WHERE caller_id=_caller;
 SELECT count(*) INTO posts FROM wall_posts WHERE caller_id=_caller;
 SELECT count(*) INTO ratings FROM art_ratings WHERE caller_id=_caller;
 SELECT (SELECT count(*) FROM corner_runs WHERE caller_id=_caller AND score IS NOT NULL)+(SELECT count(*) FROM door_scores WHERE caller_id=_caller AND floor=5) INTO runs;
 earned := CASE WHEN days>=6 AND pieces>=60 AND runs>=1 AND ratings>=3 THEN 'ELITE' WHEN (days>=2 OR pieces>=15) AND lines>=1 THEN 'VALIDATED' ELSE 'NEW USER' END;
 INSERT INTO caller_access(caller_id,level) VALUES(_caller,earned) ON CONFLICT(caller_id) DO UPDATE SET level=CASE WHEN caller_access.level='ELITE' OR EXCLUDED.level='ELITE' THEN 'ELITE' WHEN caller_access.level='VALIDATED' OR EXCLUDED.level='VALIDATED' THEN 'VALIDATED' ELSE 'NEW USER' END RETURNING level INTO saved;
 UPDATE callers SET speed_unlocked=CASE saved WHEN 'ELITE' THEN 28800 WHEN 'VALIDATED' THEN 14400 ELSE 9600 END,files_viewed=pieces WHERE id=_caller;
 result := jsonb_build_object('level',saved,'days',days,'pieces',pieces,'oneliners',lines,'wallPosts',posts,'ratings',ratings,'finishedRuns',runs,'calls',(SELECT calls FROM callers WHERE id=_caller),'credits',COALESCE((SELECT sum(amount) FROM credit_ledger WHERE caller_id=_caller),0),'crawlBest',COALESCE((SELECT max(score) FROM door_scores WHERE caller_id=_caller),0),'cornerBest',COALESCE((SELECT max(score) FROM corner_runs WHERE caller_id=_caller),0));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.caller_record(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.caller_record(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.charge_call(_session uuid,_caller uuid,_close boolean DEFAULT false) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r call_sessions; used integer;
BEGIN
 SELECT * INTO r FROM call_sessions WHERE id=_session AND caller_id=_caller FOR UPDATE;
 IF FOUND AND NOT r.closed THEN
 UPDATE call_sessions SET used_seconds=used_seconds+GREATEST(0,LEAST(150,EXTRACT(EPOCH FROM now()-charged_at)::integer)),charged_at=now(),closed=_close WHERE id=r.id;
 END IF;
 SELECT COALESCE(sum(used_seconds),0) INTO used FROM call_sessions WHERE caller_id=_caller AND day=(now() AT TIME ZONE 'UTC')::date;
 RETURN used;
END $$;
REVOKE ALL ON FUNCTION public.charge_call(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.charge_call(uuid,uuid,boolean) TO service_role;