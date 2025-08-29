-- Fix infinite recursion in profiles policies

-- 1. Drop problematic recursive policies
DROP POLICY IF EXISTS "Users can update own profile (restricted)" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles (secure)" ON public.profiles;

-- 2. Create non-recursive policies

-- Users can update only specific fields, not role/email
CREATE POLICY "Users can update own profile fields" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id) 
WITH CHECK (
  auth.uid() = id AND 
  -- Don't allow changing critical fields
  role = OLD.role AND
  email = OLD.email
);

-- Admins can update any profile including role/email  
CREATE POLICY "Admins can update profiles" 
ON public.profiles 
FOR UPDATE 
USING (public.get_current_user_role() = 'admin') 
WITH CHECK (public.get_current_user_role() = 'admin');

-- Admins can insert new profiles
CREATE POLICY "Admins can insert profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (public.get_current_user_role() = 'admin');

-- 3. Ensure user can always view their own profile (critical for login)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);