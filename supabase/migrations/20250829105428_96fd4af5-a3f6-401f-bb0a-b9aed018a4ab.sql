-- Update RLS policy to allow students to mark themselves present when liveness is confirmed
DROP POLICY IF EXISTS "Students can update own attendance (restricted)" ON attendance;

CREATE POLICY "Students can update own attendance (restricted)" ON attendance
FOR UPDATE 
USING (auth.uid() = student_id)
WITH CHECK (
  auth.uid() = student_id AND 
  (
    status = 'pending' OR 
    (status = 'present' AND liveness = true AND EXISTS (
      SELECT 1 FROM sessions 
      WHERE sessions.id = attendance.session_id AND sessions.status = 'active'
    ))
  )
);