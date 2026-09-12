/*
  # Allow self-signup, restricted to the teacher role

  There's still no public way to create a bursar or director account — those
  remain admin-assigned only (see SETUP.md). This policy lets a newly
  registered user insert their own profile row, but the `role = 'teacher'`
  check is enforced by Postgres itself, not just the app's UI — so even a
  request sent directly to the API (bypassing the app entirely) cannot be
  used to self-assign bursar or director access.
*/

create policy "Users can create their own teacher profile"
  on profiles
  for insert
  to authenticated
  with check (auth.uid() = id and role = 'teacher');
