
-- 1) Create the trigger to auto-create profiles on user signup
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

-- 2) Backfill profiles for any existing users that are missing a profile
insert into public.profiles (id, name, email, role)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'name', 'User') as name,
  u.email,
  coalesce((u.raw_user_meta_data ->> 'role')::public.user_role, 'student'::public.user_role) as role
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
