-- Drop existing triggers and recreate them properly
DROP TRIGGER IF EXISTS validate_attendance_update_improved ON attendance;
DROP TRIGGER IF EXISTS validate_attendance_update ON attendance;

-- Update the existing attendance validation function to work with the new register system
CREATE OR REPLACE FUNCTION validate_attendance_update_improved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  session_teacher_id uuid;
  session_status text;
  user_role text;
BEGIN
  -- Get session info
  SELECT teacher_id, status INTO session_teacher_id, session_status
  FROM sessions WHERE id = NEW.session_id;

  -- Get current user role
  SELECT role INTO user_role FROM profiles WHERE id = auth.uid();

  -- If student is updating their own record
  IF auth.uid() = NEW.student_id THEN
    -- Students can only mark as pending when session is active
    IF NEW.status NOT IN ('pending') THEN
      RAISE EXCEPTION 'Students can only mark attendance as pending';
    END IF;
    
    IF session_status != 'active' THEN
      RAISE EXCEPTION 'Cannot update attendance for inactive session';
    END IF;
  
  -- If teacher is updating (including from register)
  ELSIF auth.uid() = session_teacher_id OR user_role = 'teacher' THEN
    -- Teachers can set any status for their classes
    -- Allow the update
    NULL;
    
  -- If admin is updating
  ELSIF user_role = 'admin' THEN
    -- Admins can update any attendance
    NULL;
  
  ELSE
    RAISE EXCEPTION 'Unauthorized attendance update';
  END IF;

  -- Set updated timestamp
  NEW.created_at = COALESCE(OLD.created_at, NOW());
  
  RETURN NEW;
END;
$$;

-- Create the trigger with the improved validation
CREATE TRIGGER validate_attendance_update_improved
    BEFORE INSERT OR UPDATE ON attendance
    FOR EACH ROW
    EXECUTE FUNCTION validate_attendance_update_improved();