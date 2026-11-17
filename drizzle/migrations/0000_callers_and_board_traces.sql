CREATE TABLE public.callers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle text NOT NULL,
  handle_lower text NOT NULL UNIQUE,
  city text NOT NULL DEFAULT '',
  token_hashes text[] NOT NULL DEFAULT '{}',
  phrase_hash text,
  calls integer NOT NULL DEFAULT 0,
  files_viewed integer NOT NULL DEFAULT 0,
  speed_unlocked integer NOT NULL DEFAULT 9600,
  banned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_call_at timestamptz
);
CREATE INDEX callers_tokens_idx ON public.callers USING gin (token_hashes);

CREATE TABLE public.call_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id uuid,
  token_hash text NOT NULL,
  handle text,
  city text NOT NULL DEFAULT '',
  speed integer NOT NULL DEFAULT 9600,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX call_log_recent_idx ON public.call_log (created_at DESC);
CREATE INDEX call_log_token_idx ON public.call_log (token_hash, created_at DESC);

CREATE TABLE public.oneliners (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  caller_id uuid NOT NULL,
  handle text NOT NULL,
  body text NOT NULL,
  token_hash text NOT NULL,
  ip_hash text NOT NULL,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX oneliners_recent_idx ON public.oneliners (created_at DESC);

CREATE TABLE public.presence (
  session_id text PRIMARY KEY,
  token_hash text NOT NULL,
  handle text,
  city text NOT NULL DEFAULT '',
  speed integer NOT NULL DEFAULT 9600,
  doing text NOT NULL DEFAULT 'logging on',
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.views (
  viewer text NOT NULL,
  pack text NOT NULL,
  file text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (viewer, pack, file)
);
CREATE INDEX views_file_idx ON public.views (pack, file);

CREATE TABLE public.reports (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pack text NOT NULL,
  file text NOT NULL,
  reason smallint NOT NULL CHECK (reason BETWEEN 1 AND 3),
  handle text,
  token_hash text NOT NULL,
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.flags (
  pack text NOT NULL,
  file text NOT NULL,
  hidden boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pack, file)
);

CREATE TABLE public.daily_counters (
  day date NOT NULL,
  step text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, step)
);

CREATE TABLE public.rate_hits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key text NOT NULL,
  action text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rate_hits_idx ON public.rate_hits (key, action, at DESC);

GRANT ALL ON public.callers, public.call_log, public.oneliners, public.presence, public.views, public.reports, public.flags, public.daily_counters, public.rate_hits TO service_role;

ALTER TABLE public.callers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oneliners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_hits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.bump_counter(_step text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.daily_counters (day, step, count) VALUES ((now() AT TIME ZONE 'utc')::date, _step, 1)
  ON CONFLICT (day, step) DO UPDATE SET count = public.daily_counters.count + 1;
$$;

CREATE OR REPLACE FUNCTION public.top_files(_limit integer)
RETURNS TABLE (pack text, file text, views bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.pack, v.file, count(*) AS views FROM public.views v
  WHERE NOT EXISTS (SELECT 1 FROM public.flags f WHERE f.pack = v.pack AND f.file = v.file AND f.hidden)
  GROUP BY v.pack, v.file ORDER BY views DESC, max(v.created_at) DESC LIMIT _limit;
$$;

REVOKE ALL ON FUNCTION public.bump_counter(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.top_files(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_counter(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.top_files(integer) TO service_role;