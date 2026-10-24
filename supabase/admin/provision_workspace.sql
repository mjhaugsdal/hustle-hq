-- Run as postgres in the SQL editor after the intended owner has signed up.
-- Replace these two values. Never run this file from a browser or public client.
do $$
declare
  owner_email text := 'replace-with-owner-email@example.com';
  workspace_name text := 'My Side Hustle HQ';
  owner_id uuid;
  workspace_id uuid;
begin
  select id into owner_id from auth.users where lower(email) = lower(owner_email);
  if owner_id is null then
    raise exception 'No signed-up user exists for the configured owner email';
  end if;

  insert into public.workspaces (name) values (workspace_name) returning id into workspace_id;
  insert into public.workspace_members (workspace_id, user_id, role)
    values (workspace_id, owner_id, 'owner');
  raise notice 'Workspace created: %', workspace_id;
end;
$$;

-- To invite another already-signed-up user, run trusted SQL using the returned ID:
-- insert into public.workspace_members (workspace_id, user_id, role)
-- select '<workspace-uuid>'::uuid, id, 'member'
-- from auth.users where lower(email) = lower('another-member@example.com');
