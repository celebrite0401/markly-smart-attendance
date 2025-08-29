-- Enable realtime for the attendance table
ALTER TABLE public.attendance REPLICA IDENTITY FULL;

-- Add attendance table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;