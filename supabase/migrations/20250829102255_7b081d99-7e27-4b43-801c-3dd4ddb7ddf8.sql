-- Fix the auto-enroll function to remove postgres_logs dependency
CREATE OR REPLACE FUNCTION public.auto_enroll_student_on_section_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    
    -- Removed the postgres_logs insert since the table doesn't exist
    
  END IF;
  
  RETURN NEW;
END;
$$;