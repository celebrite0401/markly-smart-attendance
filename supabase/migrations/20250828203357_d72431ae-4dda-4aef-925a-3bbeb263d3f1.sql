-- Fix remaining security warnings

-- Fix function search path for validate_attendance_update
CREATE OR REPLACE FUNCTION public.validate_attendance_update()
RETURNS TRIGGER AS $$
DECLARE
  session_teacher_id uuid;
  session_status text;
BEGIN
  -- Get session info
  SELECT teacher_id, status INTO session_teacher_id, session_status
  FROM sessions WHERE id = NEW.session_id;

  -- If student is updating their own record
  IF auth.uid() = NEW.student_id THEN
    -- Students can only mark as pending when session is active
    IF NEW.status NOT IN ('pending') THEN
      RAISE EXCEPTION 'Students can only mark attendance as pending';
    END IF;
    
    IF session_status != 'active' THEN
      RAISE EXCEPTION 'Cannot update attendance for inactive session';
    END IF;
  
  -- If teacher is updating
  ELSIF auth.uid() = session_teacher_id THEN
    -- Teachers can set any status
    -- Allow the update
    NULL;
  
  ELSE
    RAISE EXCEPTION 'Unauthorized attendance update';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;