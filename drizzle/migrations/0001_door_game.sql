CREATE TABLE public.door_scores (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  caller_id uuid NOT NULL,
  handle text NOT NULL,
  score integer NOT NULL CHECK (score >= 0 AND score <= 100000),
  floor integer NOT NULL CHECK (floor BETWEEN 0 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.door_scores TO service_role;
ALTER TABLE public.door_scores ENABLE ROW LEVEL SECURITY;
CREATE INDEX door_scores_score_idx ON public.door_scores (score DESC);

CREATE TABLE public.door_turns (
  viewer text NOT NULL,
  day date NOT NULL,
  turns integer NOT NULL DEFAULT 0,
  PRIMARY KEY (viewer, day)
);
GRANT ALL ON public.door_turns TO service_role;
ALTER TABLE public.door_turns ENABLE ROW LEVEL SECURITY;