-- 1) Allow students to UPDATE their own attendance rows
-- (Students already have SELECT and INSERT policies, but updates currently fail)
CREATE POLICY "Students can update their own attendance"
  ON public.attendance
  FOR UPDATE
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- 2) Ensure realtime works smoothly for live teacher updates
-- Capture full row images for updates
ALTER TABLE public.attendance REPLICA IDENTITY FULL;

-- Add the attendance table to the realtime publication (safe to run once)
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;

-- 3) Performance: speed up lookups/updates by session_id + student_id
CREATE INDEX IF NOT EXISTS idx_attendance_session_student
  ON public.attendance (session_id, student_id);