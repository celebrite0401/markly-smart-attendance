-- Enable full replica identity for attendance table to capture complete row data
ALTER TABLE public.attendance REPLICA IDENTITY FULL;

-- Add attendance table to realtime publication for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;