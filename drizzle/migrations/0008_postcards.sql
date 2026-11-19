CREATE TABLE public.postcards (
  id text PRIMARY KEY,
  board text NOT NULL,
  design text NOT NULL,
  lines text[] NOT NULL,
  signature text NOT NULL,
  enclosed jsonb,
  caller_id uuid,
  token_hash text NOT NULL,
  ip_hash text NOT NULL,
  clean boolean NOT NULL DEFAULT true,
  hidden boolean NOT NULL DEFAULT false,
  reply_to text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '180 days'
);
GRANT ALL ON public.postcards TO service_role;
ALTER TABLE public.postcards ENABLE ROW LEVEL SECURITY;
CREATE INDEX postcards_sender_day ON public.postcards (token_hash, created_at);
CREATE INDEX postcards_caller_day ON public.postcards (caller_id, created_at);
CREATE TABLE public.postcard_opens (
  card_id text NOT NULL,
  device text NOT NULL,
  day date NOT NULL,
  PRIMARY KEY (card_id, device, day)
);
GRANT ALL ON public.postcard_opens TO service_role;
ALTER TABLE public.postcard_opens ENABLE ROW LEVEL SECURITY;