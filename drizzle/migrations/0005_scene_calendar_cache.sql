CREATE TABLE public.scene_bulletins(day date PRIMARY KEY,ready boolean NOT NULL DEFAULT false,started_at timestamptz NOT NULL DEFAULT now(),payload jsonb NOT NULL DEFAULT '{}'::jsonb);
GRANT ALL ON public.scene_bulletins TO service_role;
ALTER TABLE public.scene_bulletins ENABLE ROW LEVEL SECURITY;