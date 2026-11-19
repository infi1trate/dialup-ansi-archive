CREATE TABLE public.archive_index (pack text NOT NULL, file text NOT NULL, year integer NOT NULL DEFAULT 1993, title text NOT NULL DEFAULT '', artist text NOT NULL DEFAULT '', groups text NOT NULL DEFAULT '', PRIMARY KEY(pack,file));
GRANT ALL ON public.archive_index TO service_role;
ALTER TABLE public.archive_index ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.caller_shelf (caller_id uuid NOT NULL, pack text NOT NULL, file text NOT NULL, PRIMARY KEY(caller_id,pack,file));
GRANT ALL ON public.caller_shelf TO service_role;
ALTER TABLE public.caller_shelf ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.credit_ledger (caller_id uuid NOT NULL, event text NOT NULL, amount integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(caller_id,event));
GRANT ALL ON public.credit_ledger TO service_role;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.art_ratings (caller_id uuid NOT NULL, pack text NOT NULL, file text NOT NULL, rating smallint NOT NULL CHECK(rating BETWEEN 1 AND 5), PRIMARY KEY(caller_id,pack,file));
GRANT ALL ON public.art_ratings TO service_role;
ALTER TABLE public.art_ratings ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.corner_runs (caller_id uuid NOT NULL, day date NOT NULL DEFAULT current_date, seed bigint NOT NULL, handle text NOT NULL, actions jsonb NOT NULL DEFAULT '[]', score bigint, PRIMARY KEY(caller_id,day));
GRANT ALL ON public.corner_runs TO service_role;
ALTER TABLE public.corner_runs ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.board_credit(_caller uuid, _event text, _amount integer) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE balance integer;
BEGIN
PERFORM pg_advisory_xact_lock(hashtext(_caller::text));
SELECT coalesce(sum(amount),0) INTO balance FROM credit_ledger WHERE caller_id=_caller;
IF EXISTS(SELECT 1 FROM credit_ledger WHERE caller_id=_caller AND event=_event) THEN RETURN balance; END IF;
IF balance+_amount<0 THEN RETURN -1; END IF;
INSERT INTO credit_ledger(caller_id,event,amount) VALUES(_caller,_event,_amount);
RETURN balance+_amount;
END; $$;
REVOKE ALL ON FUNCTION public.board_credit(uuid,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.board_credit(uuid,text,integer) TO service_role;