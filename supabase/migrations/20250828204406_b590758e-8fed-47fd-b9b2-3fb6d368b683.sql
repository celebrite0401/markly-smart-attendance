-- Force drop all policies and recreate from scratch

-- Drop ALL existing policies on profiles
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'profiles' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON public.profiles';
    END LOOP;
END $$;

-- Now create clean policies without recursion
CREATE POLICY "users_view_own_profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "users_update_own_profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "admins_full_access" 
ON public.profiles 
FOR ALL
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');

CREATE POLICY "teachers_view_class_students" 
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

CREATE POLICY "students_view_class_teachers" 
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