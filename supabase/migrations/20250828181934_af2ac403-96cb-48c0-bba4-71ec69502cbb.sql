-- 1) Ensure attendance table emits full row images for realtime
ALTER TABLE public.attendance REPLICA IDENTITY FULL;

-- 2) Add attendance to the supabase_realtime publication (idempotent-safe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'attendance'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance';
  END IF;
END$$;

-- 3) Ensure sessions table emits full row images for realtime
ALTER TABLE public.sessions REPLICA IDENTITY FULL;

-- 4) Add sessions to the supabase_realtime publication (idempotent-safe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'sessions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions';
  END IF;
END$$;