-- Step 1: Create new non-inlined functions to prevent recursion
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN (SELECT role FROM public.profiles WHERE id = auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin';
END;
$$;

-- Step 2: Drop all problematic policies that cause recursion
DROP POLICY IF EXISTS "admins_full_access" ON public.profiles;
DROP POLICY IF EXISTS "teachers_view_class_students" ON public.profiles;
DROP POLICY IF EXISTS "students_view_class_teachers" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all classes" ON public.classes;
DROP POLICY IF EXISTS "Admins can manage enrollments" ON public.enrollments;

-- Step 3: Add new simplified policies using non-inlined functions
-- Profiles policies
CREATE POLICY "admins_full_access" ON public.profiles
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Classes policies  
CREATE POLICY "Admins can manage all classes" ON public.classes
FOR ALL
USING (public.is_admin());

-- Enrollments policies
CREATE POLICY "Admins can manage enrollments" ON public.enrollments
FOR ALL
USING (public.is_admin());