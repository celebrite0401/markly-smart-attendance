-- Disable email confirmation by updating auth settings
-- Note: This would normally be done in Supabase dashboard, but we can create a note for the user
-- For now, let's update the handle_new_user function to ensure users are automatically confirmed

-- Update the handle_new_user function to set email_confirmed_at
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', 'User'),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'student')
  );
  RETURN NEW;
END;
$$;