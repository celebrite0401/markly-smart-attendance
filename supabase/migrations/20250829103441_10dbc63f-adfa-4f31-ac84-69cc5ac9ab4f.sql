-- Create a lightweight logs table to prevent errors from functions referencing it
CREATE TABLE IF NOT EXISTS public.postgres_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_message text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Optional: index for querying by time
CREATE INDEX IF NOT EXISTS idx_postgres_logs_created_at ON public.postgres_logs (created_at DESC);
