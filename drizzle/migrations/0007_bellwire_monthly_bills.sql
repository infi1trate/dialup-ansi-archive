CREATE TABLE public.phone_bills(caller_id uuid NOT NULL,month text NOT NULL,payload jsonb NOT NULL,delivered_at timestamptz,read_at timestamptz,PRIMARY KEY(caller_id,month));
GRANT ALL ON public.phone_bills TO service_role;
ALTER TABLE public.phone_bills ENABLE ROW LEVEL SECURITY;
COMMENT ON FUNCTION public.charge_call(uuid,uuid,boolean) IS 'DEPRECATED: replaced by time_bank UTC accounting';