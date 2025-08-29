-- Fix security vulnerability: Restrict profile access to prevent data exposure
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create security definer function to get current user role (avoids infinite recursion)
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Create more restrictive policies for profile access
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Teachers can view student profiles in their classes" 
ON public.profiles 
FOR SELECT 
USING (
  public.get_current_user_role() = 'teacher' 
  AND role = 'student' 
  AND EXISTS (
    SELECT 1 FROM enrollments e
    JOIN classes c ON e.class_id = c.id
    WHERE e.student_id = profiles.id 
    AND c.teacher_id = auth.uid()
  )
);

CREATE POLICY "Students can view teacher profiles for their classes" 
ON public.profiles 
FOR SELECT 
USING (
  public.get_current_user_role() = 'student' 
  AND role = 'teacher' 
  AND EXISTS (
    SELECT 1 FROM enrollments e
    JOIN classes c ON e.class_id = c.id
    WHERE e.student_id = auth.uid() 
    AND c.teacher_id = profiles.id
  )
);