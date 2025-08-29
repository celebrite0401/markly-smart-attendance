-- Update the handle_new_user function to include section and roll_number
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, section, roll_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', 'User'),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data ->> 'role')::public.user_role, 'student'::public.user_role),
    NEW.raw_user_meta_data ->> 'section',
    NEW.raw_user_meta_data ->> 'rollNumber'
  );
  RETURN NEW;
END;
$function$;