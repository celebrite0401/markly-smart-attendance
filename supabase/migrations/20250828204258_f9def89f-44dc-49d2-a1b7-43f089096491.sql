-- Complete fix for infinite recursion - drop and recreate all profiles policies

-- Drop all existing policies on profiles table
DROP POLICY IF EXISTS "Users can update profile safe fields" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can create profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Students can view teacher profiles for their classes" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can view student profiles in their classes" ON public.profiles;

-- Recreate clean, non-recursive policies

-- 1. User can view their own profile (essential for login)
CREATE POLICY "profile_select_own" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- 2. User can update their own profile (safe fields only via trigger)
CREATE POLICY "profile_update_own" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 3. Admin policies (using security definer function)
CREATE POLICY "profile_admin_select_all" 
ON public.profiles 
FOR SELECT 
USING (public.get_current_user_role() = 'admin');

CREATE POLICY "profile_admin_update_all" 
ON public.profiles 
FOR UPDATE 
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');

CREATE POLICY "profile_admin_insert" 
ON public.profiles 
FOR INSERT 
WITH CHECK (public.get_current_user_role() = 'admin');

-- 4. Teacher/Student visibility policies
CREATE POLICY "profile_teacher_view_students" 
ON public.profiles 
FOR SELECT 
USING (
  public.get_current_user_role() = 'teacher' AND 
  role = 'student' AND 
  EXISTS (
    SELECT 1 FROM enrollments e
    JOIN classes c ON e.class_id = c.id
    WHERE e.student_id = profiles.id AND c.teacher_id = auth.uid()
  )
);

CREATE POLICY "profile_student_view_teachers" 
ON public.profiles 
FOR SELECT 
USING (
  public.get_current_user_role() = 'student' AND 
  role = 'teacher' AND 
  EXISTS (
    SELECT 1 FROM enrollments e
    JOIN classes c ON e.class_id = c.id
    WHERE e.student_id = auth.uid() AND c.teacher_id = profiles.id
  )
);