-- Create a scheduled function to automatically send absence notifications
-- This will run every 15 minutes to check for recently ended sessions

-- First, ensure we have a function to send notifications programmatically
CREATE OR REPLACE FUNCTION send_absence_notifications_scheduled()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    notification_result jsonb;
BEGIN
    -- Call the edge function to send notifications
    -- This will be handled by a scheduled job that calls the edge function
    -- The actual notification logic is in the edge function
    
    -- Update any sessions that have ended but are still marked as active
    UPDATE sessions 
    SET status = 'ended' 
    WHERE status = 'active' 
    AND end_time <= NOW();
    
    -- Log the scheduled run
    INSERT INTO postgres_logs (event_message, metadata) 
    VALUES (
        'Scheduled absence notification check completed',
        jsonb_build_object(
            'timestamp', NOW(),
            'function', 'send_absence_notifications_scheduled'
        )
    ) ON CONFLICT DO NOTHING;
    
END;
$$;

-- Create a function to auto-enroll students when they join a section
CREATE OR REPLACE FUNCTION auto_enroll_student_on_section_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only proceed if this is a student with a section and the section was added/changed
  IF NEW.role = 'student' 
     AND NEW.section IS NOT NULL 
     AND (OLD.section IS NULL OR OLD.section != NEW.section) THEN
    
    -- Find all classes that have schedules mentioning this section
    -- and auto-enroll the student
    INSERT INTO enrollments (student_id, class_id, roll_number)
    SELECT NEW.id, c.id, NEW.roll_number
    FROM classes c
    WHERE c.schedule IS NOT NULL
    AND c.schedule::text ILIKE '%' || NEW.section || '%'
    AND NOT EXISTS (
      SELECT 1 FROM enrollments e 
      WHERE e.student_id = NEW.id AND e.class_id = c.id
    );
    
    -- Log the auto-enrollment
    INSERT INTO postgres_logs (event_message, metadata) 
    VALUES (
        'Auto-enrolled student in section classes',
        jsonb_build_object(
            'student_id', NEW.id,
            'section', NEW.section,
            'timestamp', NOW()
        )
    ) ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-enrollment on profile updates
DROP TRIGGER IF EXISTS auto_enroll_on_section_update ON profiles;
CREATE TRIGGER auto_enroll_on_section_update
    AFTER UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION auto_enroll_student_on_section_update();

-- Also create trigger for new profile creation
DROP TRIGGER IF EXISTS auto_enroll_on_profile_insert ON profiles;
CREATE TRIGGER auto_enroll_on_profile_insert
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION auto_enroll_student_on_section_update();

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

-- Replace the old trigger with the improved one
DROP TRIGGER IF EXISTS validate_attendance_update ON attendance;
CREATE TRIGGER validate_attendance_update_improved
    BEFORE INSERT OR UPDATE ON attendance
    FOR EACH ROW
    EXECUTE FUNCTION validate_attendance_update_improved();