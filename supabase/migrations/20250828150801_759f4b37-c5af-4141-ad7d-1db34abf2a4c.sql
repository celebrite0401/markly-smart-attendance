-- Update admin@smart.com user role to admin
UPDATE profiles 
SET role = 'admin'::user_role 
WHERE email = 'admin@smart.com';