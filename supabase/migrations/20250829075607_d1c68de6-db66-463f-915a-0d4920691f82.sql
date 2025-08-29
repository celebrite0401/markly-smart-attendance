-- Fix RLS policies to allow proper joins for student names in enrollments
-- Add policy to allow teachers to view student profiles for their enrolled classes
CREATE POLICY "teachers_view_enrolled_students" ON public.profiles
FOR SELECT
USING (
  role = 'student' AND EXISTS (
    SELECT 1 FROM enrollments e
    JOIN classes c ON e.class_id = c.id
    WHERE e.student_id = profiles.id 
    AND c.teacher_id = auth.uid()
  )
);

-- Create function to auto-enroll students in section classes when they are created
CREATE OR REPLACE FUNCTION public.auto_enroll_student_in_section_classes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only proceed if this is a student with a section
  IF NEW.role = 'student' AND NEW.section IS NOT NULL THEN
    -- Find all classes that have schedules matching this section
    -- and auto-enroll the student
    INSERT INTO enrollments (student_id, class_id)
    SELECT NEW.id, c.id
    FROM classes c
    WHERE c.schedule IS NOT NULL
    AND c.schedule::text LIKE '%' || NEW.section || '%'
    AND NOT EXISTS (
      SELECT 1 FROM enrollments e 
      WHERE e.student_id = NEW.id AND e.class_id = c.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-enrollment
DROP TRIGGER IF EXISTS auto_enroll_new_students ON public.profiles;
CREATE TRIGGER auto_enroll_new_students
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_enroll_student_in_section_classes();

-- Also create trigger for when section is updated
DROP TRIGGER IF EXISTS auto_enroll_updated_students ON public.profiles;
CREATE TRIGGER auto_enroll_updated_students
  AFTER UPDATE OF section ON public.profiles
  FOR EACH ROW
  WHEN (NEW.section IS NOT NULL AND NEW.section != OLD.section)
  EXECUTE FUNCTION public.auto_enroll_student_in_section_classes();