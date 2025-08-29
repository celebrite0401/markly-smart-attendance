-- Fix infinite recursion with simple non-recursive policies

-- 1. Drop problematic policies
DROP POLICY IF EXISTS "Users can update own profile (restricted)" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles (secure)" ON public.profiles;

-- 2. Create simple policies that don't cause recursion

-- Allow users to update only safe fields (not role/email)
CREATE POLICY "Users can update profile safe fields" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Separate admin policy for all updates including role/email
CREATE POLICY "Admins can update any profile field" 
ON public.profiles 
FOR UPDATE 
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');

-- Admin insert policy
CREATE POLICY "Admins can create profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (public.get_current_user_role() = 'admin');

-- Create trigger to prevent role/email changes by non-admins
CREATE OR REPLACE FUNCTION public.prevent_critical_field_changes()
RETURNS TRIGGER AS $$
DECLARE
  user_role text;
BEGIN
  -- Get current user role
  SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
  
  -- If user is admin, allow all changes
  IF user_role = 'admin' THEN
    RETURN NEW;
  END IF;
  
  -- For non-admins, prevent role and email changes
  IF NEW.role != OLD.role THEN
    RAISE EXCEPTION 'Only admins can change user roles';
  END IF;
  
  IF NEW.email != OLD.email THEN
    RAISE EXCEPTION 'Only admins can change user emails';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
DROP TRIGGER IF EXISTS prevent_critical_changes_trigger ON public.profiles;
CREATE TRIGGER prevent_critical_changes_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_critical_field_changes();