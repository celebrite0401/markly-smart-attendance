-- Add section and roll_number fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN section text,
ADD COLUMN roll_number text;