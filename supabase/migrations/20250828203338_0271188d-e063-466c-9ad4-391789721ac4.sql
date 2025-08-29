-- Comprehensive Security Fixes for Attendance System

-- 1. Fix profiles table policies to prevent role escalation
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Create restrictive update policy that prevents role/email changes by regular users
CREATE POLICY "Users can update own profile (restricted)" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id) 
WITH CHECK (
  auth.uid() = id AND 
  role = (SELECT role FROM public.profiles WHERE id = auth.uid()) AND
  email = (SELECT email FROM public.profiles WHERE id = auth.uid())
);

-- Admin-only policy for role/email changes
CREATE POLICY "Admins can update any profile" 
ON public.profiles 
FOR UPDATE 
USING (public.get_current_user_role() = 'admin') 
WITH CHECK (public.get_current_user_role() = 'admin');

-- 2. Fix profiles INSERT policy to prevent recursion
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;

CREATE POLICY "Admins can insert profiles (secure)" 
ON public.profiles 
FOR INSERT 
WITH CHECK (public.get_current_user_role() = 'admin');

-- 3. Secure attendance policies with proper WITH CHECK
DROP POLICY IF EXISTS "Students can update their own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Teachers can view/update attendance for their sessions" ON public.attendance;

-- Student can only mark as pending, not present/rejected
CREATE POLICY "Students can update own attendance (restricted)" 
ON public.attendance 
FOR UPDATE 
USING (auth.uid() = student_id)
WITH CHECK (
  auth.uid() = student_id AND 
  status IN ('pending') AND
  EXISTS (
    SELECT 1 FROM sessions 
    WHERE sessions.id = attendance.session_id 
    AND sessions.status = 'active'
  )
);

-- Teachers can manage attendance for their sessions
CREATE POLICY "Teachers can manage session attendance" 
ON public.attendance 
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM sessions 
    WHERE sessions.id = attendance.session_id 
    AND sessions.teacher_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sessions 
    WHERE sessions.id = attendance.session_id 
    AND sessions.teacher_id = auth.uid()
  )
);

-- 4. Secure sessions policies with WITH CHECK
DROP POLICY IF EXISTS "Teachers can manage their sessions" ON public.sessions;

CREATE POLICY "Teachers can manage their sessions (secure)" 
ON public.sessions 
FOR ALL
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

-- 5. Hide QR secrets by revoking column access
REVOKE SELECT (qr_secret) ON public.sessions FROM anon, authenticated;

-- 6. Create attendance validation trigger
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS validate_attendance_update_trigger ON public.attendance;
CREATE TRIGGER validate_attendance_update_trigger
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_attendance_update();

-- 7. Restrict classes visibility (optional - making it authenticated only)
DROP POLICY IF EXISTS "Everyone can view classes" ON public.classes;

CREATE POLICY "Authenticated users can view classes" 
ON public.classes 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- 8. Create storage policies for attendance photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('attendance-photos', 'attendance-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Students can only upload to their own folder
CREATE POLICY "Students can upload their attendance photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'attendance-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND auth.role() = 'authenticated'
);

-- Teachers can view photos for their sessions only
CREATE POLICY "Teachers can view session attendance photos" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'attendance-photos' 
  AND EXISTS (
    SELECT 1 
    FROM attendance a
    JOIN sessions s ON a.session_id = s.id
    WHERE s.teacher_id = auth.uid()
    AND a.photo_url LIKE '%' || name
  )
);

-- Admins can view all attendance photos
CREATE POLICY "Admins can view all attendance photos" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'attendance-photos' 
  AND public.get_current_user_role() = 'admin'
);